import { AFTER_ENTER, AFTER_LEAVE, ENTER_CANCELLED, LEAVE_CANCELLED } from '../core/transition';
import type { RenderFn, Attributes } from '../core/component';
import { __, isComponent, attrs as wrapAttrs, Component } from '../core/component';
import { createFragment } from '../util';
import { TransitionComponent } from './transition';

function createEl(renderFn: RenderFn, context: Record<string | symbol, unknown>) {
  const attrs = wrapAttrs({
    [__]: {
      context,
      slots: {
        default: renderFn,
      },
    },
  });
  return Component.create(attrs);
}

function renderSwitch(component: Component, slot: string, isEnter = false) {
  const renderFn = component[__].slots?.[slot];
  const roots = component[__].rootNodes;
  if (!renderFn) {
    roots.push(document.createComment(slot));
    return roots as Node[];
  }
  const el = createEl(renderFn, component[__].context);
  roots.push(el);
  const doms = el.__render();
  for (const node of el[__].rootNodes) {
    if (isComponent(node) && node instanceof TransitionComponent) {
      node.__transition(isEnter, true);
    }
  }
  return doms;
}

function doLeave(
  component: IfComponent | SwitchComponent,
  el: Component,
  doEnterCb?: (refDOM?: Node) => void,
) {
  let tc_count = 0; // transition component 的总量
  const onEnd = (callCb: boolean) => {
    tc_count--; // 每一个 transition component 过渡结束后，tc_count 减 1。
    // tc_count 减到 0 时说明所有 transition component 都过渡结束，销毁 el 并调用 callback。
    if (tc_count === 0) {
      component._l = undefined;
      // 注意此处需要先触发 doEnter 回调，再调用 __destroy 销毁 dom，
      callCb && doEnterCb?.();
      // 因为 doEnter 回调时会依赖 el 的 __lastDOM 来作为参照 dom 执行 insertBefore 插入，如果 el 已经被删除，则无法正确插入。
      el.__destroy();
    }
  };
  for (const node of el[__].rootNodes) {
    if (isComponent(node) && node instanceof TransitionComponent) {
      tc_count++; // 对每一个 transition component，统计量加 1
      const lc = () => {
        node.__off(AFTER_LEAVE, al);
        onEnd(false);
      };
      const al = () => {
        node.__off(LEAVE_CANCELLED, lc);
        onEnd(true);
      };
      node.__on(AFTER_LEAVE, al, { once: true });
      node.__on(LEAVE_CANCELLED, lc, { once: true });
      node.__transition(false, false);
    }
  }
  // 如果 tc_count 统计之后就是 0，说明没有 transition component，直接销毁 el 并调用 callback
  if (tc_count === 0) {
    // 注意此处需要先触发 doEnter 回调，再调用 __destroy 销毁 dom，
    doEnterCb?.();
    el.__destroy();
  } else {
    component._l = el;
  }
}

function insertAfter(refDOM: Node, newNode: Node) {
  const pn = refDOM.parentNode;
  const ns = refDOM.nextSibling;
  ns ? pn.insertBefore(newNode, ns) : pn.appendChild(newNode);
}

function doEnter(
  component: IfComponent | SwitchComponent,
  enterRenderFn: RenderFn,
  refDOM: Node,
  slot: string,
  cb?: () => void,
) {
  const roots = component[__].rootNodes;
  if (!enterRenderFn) {
    const cmt = document.createComment(slot);
    roots.push(cmt);
    insertAfter(refDOM, cmt);
    return;
  }
  const newEl = createEl(enterRenderFn, component[__].context);
  const nodes = newEl.__render();
  let tc_count = 0;
  const onEnd = () => {
    tc_count--;
    tc_count === 0 && cb?.();
  };
  for (const node of newEl[__].rootNodes) {
    if (isComponent(node) && node instanceof TransitionComponent) {
      tc_count++;
      const ec = () => {
        node.__off(AFTER_ENTER, ae);
      };
      const ae = () => {
        node.__off(ENTER_CANCELLED, ec);
        onEnd();
      };
      node.__on(AFTER_ENTER, ae, { once: true });
      node.__on(ENTER_CANCELLED, ec, { once: true });
      node.__transition(true, false);
    }
  }
  roots.push(newEl);
  const nn = nodes.length > 1 ? createFragment(nodes) : nodes[0];
  insertAfter(refDOM, nn);
  newEl.__handleAfterRender();
  if (tc_count === 0) {
    cb?.();
  }
}

function doUpdate(component: IfComponent | SwitchComponent, slot: string) {
  const roots = component[__].rootNodes;
  if (roots.length > 1) throw new Error('assert failed');

  const enterRenderFn = component[__].slots?.[slot];
  if (roots.length === 0) {
    // roots.length === 0 说明上一次的 onEnter 还未执行。上一次的 onLeave 还在进行中，且切换模式是 out-in 模式。
    // 这种情况下，component._l 一定不为空
    const lastDOM = component._l.__lastDOM;
    doEnter(component, enterRenderFn, lastDOM, slot);
    component._l.__destroy();
    component._l = undefined;
    return; // 注意此处直接退出函数，不再进行后续的逻辑。
  } else if (component._l) {
    component._l.__destroy();
    component._l = undefined;
  }
  const el = roots.shift();
  const isComp = isComponent(el);
  if (isComp) {
    // 如果是组件，清理掉可能的上一次未完成的 enter 过渡。上一次未完成的 leave 过渡由 component._l 处理。
    for (const node of el[__].rootNodes) {
      if (isComponent(node) && node instanceof TransitionComponent) {
        node.__cancel(true);
      }
    }
  }
  const lastDOM = isComp ? el.__lastDOM : el;
  const parentDOM = lastDOM?.parentNode;
  let mode = component._m;
  if (!isComp || !enterRenderFn) {
    // 如果某个分支没有内容，即渲染的是空的 comment。
    // 这种情况下，空注释不会有内容展示，也就不会有 ui 过渡，因此可以直接将 mode 统一为 default 模式，可以精简代码逻辑。
    mode = undefined;
  }
  if (mode === 'out-in') {
    doLeave(component, el as Component, () => {
      doEnter(component, enterRenderFn, lastDOM, slot);
    });
  } else if (mode === 'in-out') {
    // in-out 模式下，上一次过渡的 doEnter 还未结束，则需要取消上一次的 enter。
    // 因为 leave 是在 enter 之后，所以只是取消 enter 还不够，还要强制把 leave 的元素移除。
    // 这里简单地把待移除的元素赋值到 component._l 上，这样如果 doEnter 完成之前发生下一次切换，
    // 在 137 行的地方会调用 __destroy 销毁上一次过渡需要销毁的元素。
    isComp && (component._l = el);
    doEnter(component, enterRenderFn, lastDOM, slot, () => {
      isComp && (component._l = undefined);
      isComp ? doLeave(component, el) : parentDOM.removeChild(lastDOM);
    });
  } else {
    // default 模式下，并发同时进行 enter 和 leave。
    // 请注意代码书写必须先 doEnter 再 doLeave，否则在 doLeave 时会删除 firstDOM，删除后拿不到 nextSibling
    doEnter(component, enterRenderFn, lastDOM, slot);
    isComp ? doLeave(component, el) : parentDOM.removeChild(lastDOM);
  }
}

export interface IfComponentAttrs {
  expect: boolean;
  mode?: SwitchMode;
}

type IfSlots = 'default' | 'else' | 'true' | 'false';
function getIfSlot(component: IfComponent, expect: boolean): IfSlots {
  const slots = component[__].slots;
  if (!slots) return expect ? 'default' : 'else';
  if (expect) {
    return 'true' in slots ? 'true' : 'default';
  } else {
    return 'false' in slots ? 'false' : 'else';
  }
}

export const SWITCH_EVENT_NAME = 'switched';
export type SwitchMode = 'default' | 'out-in' | 'in-out';
export class IfComponent extends Component {
  _e: boolean;
  _m: SwitchMode;
  /** 正在 leaving 中的组件 */
  _l: Component;

  constructor(attrs: Attributes<IfComponentAttrs>) {
    super(attrs);

    this.expect = attrs.expect;
    this._m = attrs.mode;
  }

  get expect(): boolean {
    return this._e;
  }

  set expect(value: boolean) {
    if (this._e === value) return;
    this._e = value;
    this.__updateIfNeed();
  }

  __render() {
    const els = renderSwitch(this, getIfSlot(this, this._e), true);
    this.__notify(SWITCH_EVENT_NAME, this._e);
    return els;
  }

  __update() {
    const s = getIfSlot(this, this._e);
    doUpdate(this, s);
    this.__notify(SWITCH_EVENT_NAME, this._e);
  }

  __beforeDestroy() {
    /** 正在 leaving 的元素不在 rootNodes 中，需要主动销毁 */
    this._l?.__destroy();
  }
}

export interface SwitchComponentAttrs {
  test: string;
  mode?: SwitchMode;
}
function getSwitchSlot(component: SwitchComponent) {
  const slots = component[__].slots;
  if (!slots) return 'default';
  return component._v in slots ? component._v : 'default';
}
export class SwitchComponent extends Component {
  _v: string;
  _m: SwitchMode;
  _l?: Component;

  constructor(attrs: Attributes<SwitchComponentAttrs>) {
    super(attrs);

    this.test = attrs.test;
    this._m = attrs.mode;
  }

  get test(): string {
    return this._v;
  }

  set test(v: string) {
    if (this._v === v) return;
    this._v = v;
    this.__updateIfNeed();
  }

  __render() {
    const els = renderSwitch(this, getSwitchSlot(this), true);
    this.__notify(SWITCH_EVENT_NAME, this._v);
    return els;
  }

  __update() {
    doUpdate(this, getSwitchSlot(this));
    this.__notify(SWITCH_EVENT_NAME, this._v);
  }

  __beforeDestroy() {
    /** 正在 leaving 的元素不在 rootNodes 中 */
    this._l?.__destroy();
  }
}
