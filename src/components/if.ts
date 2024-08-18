import { createComment, createFragment } from '../util';
import type { RenderFn } from '../core';
import {
  Component,
  CONTEXT,
  ROOT_NODES,
  SLOTS,
  DEFAULT_SLOT,
  destroyComponentContent,
  getLastDOM,
  handleRenderDone,
  UPDATE_RENDER,
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

export interface IfAttrs {
  expect: boolean;
}
export class If extends Component<
  IfAttrs,
  | JNode
  | {
      true: JNode;
      false: JNode;
    }
> {
  [EXPECT]: boolean;

  constructor(attrs: IfAttrs) {
    super();
    this[EXPECT] = this.bindAttr(attrs, 'expect', EXPECT, () => this[UPDATE_RENDER]());
  }

  render() {
    const slots = this[SLOTS];
    const e = !!this[EXPECT];
    const renderFn = slots[e.toString()] ?? (e ? slots[DEFAULT_SLOT] : undefined);
    const el = renderFn ? createEl(renderFn, this[CONTEXT]) : null;
    const roots = this[ROOT_NODES];
    if (el) {
      roots.push(el);
      return el.render();
    } else {
      const cmt = createComment(e.toString());
      roots.push(cmt);
      return roots;
    }
  }

  [UPDATE_RENDER]() {
    const lastNode = getLastDOM(this);
    const nextSib = lastNode.nextSibling;
    const $parent = lastNode.parentNode as Node;

    destroyComponentContent(this, true);
    const roots = this[ROOT_NODES];
    roots.length = 0;

    const slots = this[SLOTS];
    const e = !!this[EXPECT];
    const renderFn = slots[e.toString()] ?? (e ? slots[DEFAULT_SLOT] : undefined);
    const el = renderFn ? createEl(renderFn, this[CONTEXT]) : null;
    if (el) {
      roots.push(el);
      const doms = el.render();
      const newNode = doms.length > 1 ? createFragment(doms) : doms[0];
      if (nextSib) {
        $parent.insertBefore(newNode, nextSib);
      } else {
        $parent.appendChild(newNode);
      }
      handleRenderDone(el);
    } else {
      const cmt = createComment(e.toString());
      roots.push(cmt);
      if (nextSib) {
        $parent.insertBefore(cmt, nextSib);
      } else {
        $parent.appendChild(cmt);
      }
    }
  }
}
