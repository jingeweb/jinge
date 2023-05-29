import { Attributes, Component, __, isComponent } from '../core/component';
import { TransitionComponent } from './transition';

function setDisplay(el: HTMLElement, show: boolean) {
  if (el.nodeType === Node.ELEMENT_NODE) {
    el.style.display = show ? '' : 'none';
  }
}

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

  __render() {
    const els = super.__render();
    this.__update(true);
    return els;
  }

  __update(isFirst = false) {
    for (const node of this[__].rootNodes) {
      if (isComponent(node)) {
        if (node instanceof TransitionComponent) {
          node.__cancel();
          if (this.test) {
            node.__on('before-enter', () => setDisplay(node.__firstDOM as HTMLElement, true), { once: true });
          } else {
            node.__on('after-leave', () => setDisplay(node.__firstDOM as HTMLElement, false), { once: true });
          }
          node.__transition(this.test, isFirst);
        } else {
          setDisplay(node.__firstDOM as HTMLElement, this.test);
        }
      } else {
        setDisplay(node as HTMLElement, this.test);
      }
    }
  }
}
