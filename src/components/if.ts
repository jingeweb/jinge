import type { RenderFn } from 'src/core';
import { Component, CONTEXT, ROOT_NODES, SLOTS, __, DESTROY_CONTENT } from 'src/core';

function createEl(renderFn: RenderFn, context?: Record<string | symbol, unknown>) {
  const attrs = {
    [__]: {
      [CONTEXT]: context,
      [SLOTS]: {
        default: renderFn,
      },
    },
  };
  return new Component(attrs);
}

function renderSwitch(component: Component, slot: string) {
  const renderFn = component[__][SLOTS]?.[slot];
  const roots = component[__][ROOT_NODES];
  if (!renderFn) {
    roots.push(document.createComment(slot));
    return roots as Node[];
  }
  const el = createEl(renderFn, component[__][CONTEXT]);
  roots.push(el);
  const doms = el.__render();
  return doms;
}

function doUpdate(component: Component, slot: string) {
  component[DESTROY_CONTENT](true);
  renderSwitch(component, slot);
}

const EXPECT = Symbol('EXPECT');

export interface IfAttrs {
  expect?: boolean;
}

type IfSlots = 'default' | 'else' | 'true' | 'false';
function getIfSlot(component: If): IfSlots {
  const slots = component[__][SLOTS];
  const expect = component[EXPECT];
  if (!slots) return expect ? 'default' : 'else';
  if (expect) {
    return 'true' in slots ? 'true' : 'default';
  } else {
    return 'false' in slots ? 'false' : 'else';
  }
}

export class If extends Component {
  [EXPECT]?: boolean;

  constructor(attrs: IfAttrs) {
    super(attrs);
    this.__bindAttr(attrs, 'expect', EXPECT);
  }

  __render(): Node[] {
    return renderSwitch(this, getIfSlot(this));
  }

  __update() {
    doUpdate(this, getIfSlot(this));
  }
}

export interface SwitchAttrs {
  expect: string;
}
function getSwitchSlot(component: Switch) {
  const slots = component[__][SLOTS];
  if (!slots) return 'default';
  const expect = component[EXPECT];
  return expect && expect in slots ? expect : 'default';
}
export class Switch extends Component {
  [EXPECT]?: string;

  constructor(attrs: SwitchAttrs) {
    super(attrs);
    this.__bindAttr(attrs, 'expect', EXPECT);
  }

  __render(): Node[] {
    return renderSwitch(this, getSwitchSlot(this));
  }

  __update() {
    doUpdate(this, getSwitchSlot(this));
  }
}
