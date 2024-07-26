import { throwErr } from '../util';
import type { RenderFn } from '../core';
import {
  Component,
  CONTEXT,
  ROOT_NODES,
  SLOTS,
  DEFAULT_SLOT,
  destroyComponentContent,
} from '../core';
import type { JNode } from '../jsx';

const EXPECT = Symbol('EXPECT');

function createEl(renderFn: RenderFn, context?: Record<string | symbol, unknown>) {
  const el = new Component();
  el[CONTEXT] = context;
  el[SLOTS] = {
    [DEFAULT_SLOT]: renderFn,
  };
  return el;
}

function doRender(component: Component, renderFn: RenderFn | undefined, cmt: string) {
  const roots = component[ROOT_NODES];
  if (!renderFn) {
    roots.push(document.createComment(cmt));
    return roots as Node[];
  }
  const el = createEl(renderFn, component[CONTEXT]);
  roots.push(el);
  const doms = el.render();
  return doms;
}
function renderIf(component: If) {
  const slots = component[SLOTS];
  const e = !!component[EXPECT];
  const renderFn = slots[e.toString()] ?? (e ? slots[DEFAULT_SLOT] : undefined);
  return doRender(component, renderFn, e.toString());
}

export class If extends Component<
  { expect: boolean },
  | JNode
  | {
      true: JNode;
      false: JNode;
    }
> {
  [EXPECT]: boolean;

  constructor(attrs: If['props']) {
    super();
    this[EXPECT] = this.bindAttr(attrs, 'expect', EXPECT, () => this.update());
  }

  render() {
    return renderIf(this);
  }

  update() {
    destroyComponentContent(this, true);
    renderIf(this);
  }
}

function renderSwitch(component: Switch) {
  const slots = component[SLOTS];
  const e = component[EXPECT];
  const renderFn = slots[e] ?? slots[DEFAULT_SLOT];
  if (!renderFn) throwErr('switch-miss-slot', e);
  return doRender(component, renderFn, e);
}
export interface SwitchAttrs {
  expect: string;
}
export class Switch extends Component {
  [EXPECT]: string;

  constructor(attrs: SwitchAttrs) {
    super();
    this[EXPECT] = this.bindAttr(attrs, 'expect', EXPECT, () => this.update());
  }

  render() {
    return renderSwitch(this);
  }

  update() {
    destroyComponentContent(this, true);
    renderSwitch(this);
  }
}
