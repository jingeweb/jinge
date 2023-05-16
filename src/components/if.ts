import { __, isComponent, attrs as wrapAttrs, RenderFn, Component, Attributes } from '../core/component';
import { createFragment } from '../util';

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

function renderSwitch(component: Component, slot: string) {
  const slots = component[__].slots;
  const renderFn = slots ? slots[slot] : null;
  const roots = component[__].rootNodes;
  if (!renderFn) {
    roots.push(document.createComment('empty'));
    return roots as Node[];
  }
  const el = createEl(renderFn, component[__].context);
  roots.push(el);
  return el.__render();
}

async function doUpdate(component: Component, slot: string) {
  const roots = component[__].rootNodes;
  const el = roots[0];
  const isComp = isComponent(el);
  const firstDOM = (isComp ? (el as Component).__firstDOM : el) as Node;
  const parentDOM = (isComp ? firstDOM : (el as Node)).parentNode;
  const renderFn = component[__].slots?.[slot];
  if (renderFn) {
    const newEl = createEl(renderFn, component[__].context);
    const nodes = await (newEl as Component).__render();
    parentDOM.insertBefore(nodes.length > 1 ? createFragment(nodes) : nodes[0], firstDOM);
    roots[0] = newEl;
  } else {
    roots[0] = document.createComment('empty');
    parentDOM.insertBefore(roots[0], firstDOM);
  }
  if (isComp) {
    await (el as Component).__destroy();
  } else {
    parentDOM.removeChild(firstDOM);
  }
  renderFn && (await (roots[0] as Component).__handleAfterRender());
}

export interface IfComponentAttrs {
  expect: boolean;
}

type IfSlots = 'default' | 'else' | 'true' | 'false';
function getIfSlot(component: IfComponent, expect: boolean): IfSlots {
  const slots = component[__].slots;
  if (!slots) return 'default';
  if (expect) {
    return 'true' in slots ? 'true' : 'default';
  } else {
    return 'false' in slots ? 'false' : 'else';
  }
}
export class IfComponent extends Component {
  _e: boolean;
  /** 当前正在更新切换到的 slot 值。__update 切换是异步的。 */
  _u: IfSlots;

  constructor(attrs: Attributes<IfComponentAttrs>) {
    super(attrs);

    this.expect = attrs.expect;
  }

  get expect(): boolean {
    return this._e;
  }

  set expect(value: boolean) {
    if (this._e === value) return;
    this._e = value;
    this.__updateIfNeed();
  }

  async __doRender() {
    const e = this._e;
    this._u = getIfSlot(this, this._e);
    const els = await renderSwitch(this, this._u);
    this._u = undefined;
    await this.__notify('branch-switched', e);
    if (e !== this._e) {
      // renderSwitch 是异步的，这个过程中，this._e 可能已经发生了变更。因此渲染结束后需要判定下是否需要重新更新。
      this.__updateIfNeed(); // 在 nextTick 中重新更新
    }
    return els;
  }

  async __update(): Promise<void> {
    if (this._u) {
      return;
    }
    const e = this._e;
    this._u = getIfSlot(this, e);
    if (!isComponent(this[__].rootNodes[0]) && !this[__].slots?.[this._u]) {
      this._u = undefined;
      return;
    }
    await doUpdate(this, this._u);
    this._u = undefined;
    await this.__notify('branch-switched', e);
    if (e !== this._e) {
      this.__updateIfNeed();
    }
  }
}

export interface SwitchComponentAttrs {
  test: string;
}
export class SwitchComponent extends Component {
  _v: string;
  _u: string;

  constructor(attrs: Attributes<SwitchComponentAttrs>) {
    super(attrs);

    this.test = attrs.test;
  }

  get test(): string {
    return this._v;
  }

  set test(v: string) {
    if (this._v === v) return;
    this._v = v;
    this.__updateIfNeed();
  }

  async __doRender() {
    const v = this._v;
    const els = await renderSwitch(this, v);
    this._u = undefined;
    if (v !== this._v) {
      // renderSwitch 是异步的，这个过程中，this._e 可能已经发生了变更。因此渲染结束后需要判定下是否需要重新更新。
      this.__updateIfNeed(); // 在 nextTick 中重新更新
    } else {
      await this.__notify('branch-switched', v);
    }
    return els;
  }

  async __update(): Promise<void> {
    if (this._u) {
      return;
    }
    const v = this._v;
    this._u = v;
    if (!isComponent(this[__].rootNodes[0]) && !this[__].slots?.[v]) {
      this._u = undefined;
      return;
    }
    await doUpdate(this, v);
    this._u = undefined;
    if (v !== this._v) {
      this.__updateIfNeed();
    } else {
      await this.__notify('branch-switched', v);
    }
  }
}
