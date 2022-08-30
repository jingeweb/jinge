import { Component, ComponentAttributes, __, attrs as wrapAttrs, RenderFn, Attributes } from '../core/component';
import { $$ } from '../vm/common';
import { createFragment } from '../util';
import { emptyRenderFn } from '../core/render_fns';

interface Render {
  component?: {
    create(attrs: ComponentAttributes): Component;
  };
  renderFn?: RenderFn;
}
export interface DynamicRenderComponentAttrs {
  render: Render;
}

function createEl(component: DynamicRenderComponent): Component {
  let Clazz = component._r?.component;
  const pAttrs = component[__].passedAttrs;
  const attrs = wrapAttrs({
    [__]: {
      slots: null,
      context: component[__].context,
    },
  });
  if (!Clazz) {
    attrs[__].slots = {
      default: component._r?.renderFn || emptyRenderFn,
    };
    Clazz = Component;
  }
  for (const attrName in pAttrs) {
    attrs[attrName] = pAttrs[attrName];
  }
  component._ca = attrs;
  if (!component._w) {
    // 不需要处理 __unwatch，因为组件销毁时也会销毁 passedAttrs
    pAttrs[$$].__watch('*', (prop) => {
      // 注意，不能写成 attrs[prop[0]] = pAttrs[prop[0]]，否则闭包会导致潜在问题
      component._ca[prop[0]] = pAttrs[prop[0]];
    });
    component._w = true;
  }
  return Clazz.create(attrs);
}

/*****
 * 动态渲染组件 `<dynamic/>`。
 *
 * 通常情况下，可以用 `<if/>` 或 `<switch/>` 组件来根据不同的条件渲染不同的组件，但这种方法在条件分支很多的时候，代码会写的很罗嗦。
 * 而使用 `<dynamic/>` 组件可以动态地渲染某个变量指定的组件。也可以使用更底层地方式，动态地使用指定的渲染函数。比如：
 *
 *
 * ````html
 * <!-- app.html -->
 * <dynamic e:render="{_component: _component}"/>
 * <dynamic e:render="{_renderFn: _renderFn}"/>
 * <button on:click="change"/>
 * ````
 *
 *
 * ````js
 * // app.js
 * import { Component, emptyRenderFn } from 'jinge';
 * import { A, B } from './components';
 * class App extends Component {
 *   constructor(attrs) {
 *     super(attrs);
 *     this._component = A;
 *     this._renderFn = emptyRenderFn;
 *   }
 *   change() {
 *     this._component = B;
 *   }
 * }
 * ````
 */
export class DynamicRenderComponent extends Component {
  _r: Render;
  /**
   * current attributes
   */
  _ca: ComponentAttributes;
  /**
   * has watched passed compiler attributes
   */
  _w: boolean;

  constructor(attrs: Attributes<DynamicRenderComponentAttrs>) {
    super(attrs);
    this._ca = null;
    this._w = false;
    this.render = attrs.render;
  }

  get render(): Render {
    return this._r;
  }

  set render(v: Render) {
    if (this._r?.component === v?.component && this._r?.renderFn === v?.renderFn) {
      return;
    }
    this._r = v;
    this.__updateIfNeed();
  }

  __render() {
    const el = createEl(this);
    this[__].rootNodes.push(el);
    return el.__render();
  }

  __update() {
    const roots = this[__].rootNodes;
    const el = roots[0] as Component;
    const fd = el.__firstDOM;
    const pa = fd.parentNode;
    const newEl = createEl(this);
    roots[0] = newEl;
    const nels = newEl.__render();
    pa.insertBefore(nels.length > 1 ? createFragment(nels) : nels[0], fd);
    el.__destroy();
    newEl.__handleAfterRender();
  }
}
