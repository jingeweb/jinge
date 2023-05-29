import { __, isComponent, attrs as wrapAttrs, RenderFn, Component, Attributes } from '../core/component';
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
  const doms = el.__render();
  for (const node of el[__].rootNodes) {
    if (isComponent(node) && node instanceof TransitionComponent) {
      node.__transition(this.test, true);
    }
  }
  return doms;
}

function doUpdate(component: Component, slot: string) {
  const roots = component[__].rootNodes;
  const el = roots[0];
  const isComp = isComponent(el);
  const firstDOM = (isComp ? (el as Component).__firstDOM : el) as Node;
  const parentDOM = (isComp ? firstDOM : (el as Node)).parentNode;
  const renderFn = component[__].slots?.[slot];
  if (renderFn) {
    const newEl = createEl(renderFn, component[__].context);
    const nodes = newEl.__render();
    parentDOM.insertBefore(nodes.length > 1 ? createFragment(nodes) : nodes[0], firstDOM);
    roots[0] = newEl;
  } else {
    roots[0] = document.createComment('empty');
    parentDOM.insertBefore(roots[0], firstDOM);
  }
  if (isComp) {
    el.__destroy();
  } else {
    parentDOM.removeChild(firstDOM);
  }
  renderFn && (roots[0] as Component).__handleAfterRender();
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

  __render() {
    const els = renderSwitch(this, getIfSlot(this, this._e));
    this.__notify('branch-switched', this._e);
    return els;
  }

  __update() {
    const s = getIfSlot(this, this._e);
    if (!isComponent(this[__].rootNodes[0]) && !this[__].slots?.[s]) {
      return;
    }
    doUpdate(this, s);
    this.__notify('branch-switched', this._e);
  }
}

export interface SwitchComponentAttrs {
  test: string;
}
export class SwitchComponent extends Component {
  _v: string;

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

  __render() {
    const els = renderSwitch(this, this._v);
    this.__notify('branch-switched', this._v);
    return els;
  }

  __update() {
    if (!isComponent(this[__].rootNodes[0]) && !this[__].slots?.[this._v]) {
      return;
    }
    doUpdate(this, this._v);
    this.__notify('branch-switched', this._v);
  }
}
