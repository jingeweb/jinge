import {
  __,
  Component,
  type RenderFn,
  ROOT_NODES,
  emptyRenderFn,
  CONTEXT,
  SLOTS,
  DESTROY,
  HANDLE_RENDER_DONE,
} from 'src/core';
import { createFragment, type AnyObj } from 'src/util';

interface ComponentConstructor {
  new (attrs: object): Component;
}
export type DynamicAttrs = {
  component?: ComponentConstructor;
  attrs?: object;
  render?: RenderFn;
};

const COMPONENT = Symbol('COMPONENT');
const RENDER = Symbol('RENDER');
const ATTRS = Symbol('ATTRS');

function createEl(component: Dynamic): Component {
  if (component[COMPONENT]) {
    const Clazz = component[COMPONENT];
    const attrs = component[ATTRS] ?? {
      [__]: {
        [CONTEXT]: component[__][CONTEXT],
      },
    };
    return new Clazz(attrs);
  } else {
    return new Component({
      [__]: {
        [CONTEXT]: component[__][CONTEXT],
        [SLOTS]: { default: component[RENDER] ?? emptyRenderFn },
      },
    });
  }
}

export class Dynamic extends Component {
  [COMPONENT]?: ComponentConstructor;
  [RENDER]?: RenderFn;
  [ATTRS]?: AnyObj;

  constructor(attrs: DynamicAttrs) {
    super();
    this[ATTRS] = attrs.attrs;
    if (attrs.attrs) {
      this[ATTRS] = attrs.attrs;
      this[ATTRS][__] = { CONTEXT: this[__][CONTEXT] };
    }
    this.__bindAttr(attrs, 'component', COMPONENT);
    this.__bindAttr(attrs, 'render', RENDER);
  }

  __render() {
    const el = createEl(this);
    this[__][ROOT_NODES].push(el);
    return el.__render();
  }

  __update() {
    const roots = this[__][ROOT_NODES];
    const el = roots[0] as Component;
    const fd = el.__firstDOM;
    const pa = fd.parentNode as Node;
    const newEl = createEl(this);
    roots[0] = newEl;
    const nels = newEl.__render();
    pa.insertBefore(nels.length > 1 ? createFragment(nels) : nels[0], fd);
    el[DESTROY]();
    newEl[HANDLE_RENDER_DONE]();
  }
}
