import { Attributes, Component, __, isComponent } from '../core/component';
import { TransitionFns } from './transition';

export interface ShowComponentAttrs {
  test: boolean;
}
/**
 * 控制 show/hide 的组件。
 * 该组件只对其根子节点生效，如果子节点是 dom 元素，则控制 classList 上的 `jg-hide`。
 *
 * 如果子节点是组件，则会调用组件上的 __show/__hide 函数。
 * 因此放置到 <show> 组件下的组件，必须实现 ShowChildComponent 这个 interface。
 */
export class ShowComponent extends Component {
  _test: boolean;

  constructor(attrs: Attributes<ShowComponentAttrs>) {
    super(attrs);
    this.test = attrs.test;
  }

  get test() {
    return this._test;
  }

  set test(v: boolean) {
    if (this._test === v) return;
    this._test = v;
    this.__updateIfNeed();
  }

  async __doRender() {
    const els = await super.__doRender();
    this.__update(true);
    return els;
  }

  __update(isFirst = false) {
    for (const node of this[__].rootNodes) {
      if (isComponent(node)) {
        if (this.test) {
          (node as unknown as TransitionFns).__enter?.(isFirst);
        } else {
          (node as unknown as TransitionFns).__leave?.(isFirst);
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      if (!this.test) {
        (node as HTMLElement).classList.add('jg-hide');
      } else {
        (node as HTMLElement).classList.remove('jg-hide');
      }
    }
  }
}
