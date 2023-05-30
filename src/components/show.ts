import { AFTER_LEAVE, BEFORE_ENTER, LEAVE_CANCELLED } from '../core/transition';
import { Attributes, Component, __, isComponent } from '../core/component';
import { TransitionComponent } from './transition';

function setDisplay(el: HTMLElement, show: boolean) {
  if (el.nodeType === Node.ELEMENT_NODE) {
    el.style.display = show ? '' : 'none';
  }
}

export interface ShowComponentAttrs {
  expect: boolean;
}
/**
 * 控制 show/hide 的组件。
 * 该组件只对其根子节点生效，如果子节点是 dom 元素，则控制 classList 上的 `jg-hide`。
 *
 * 如果子节点是组件，则会调用组件上的 __show/__hide 函数。
 * 因此放置到 <show> 组件下的组件，必须实现 ShowChildComponent 这个 interface。
 */
export class ShowComponent extends Component {
  _e: boolean;

  constructor(attrs: Attributes<ShowComponentAttrs>) {
    super(attrs);
    this.expect = attrs.expect;
  }

  get expect() {
    return this._e;
  }

  set expect(v: boolean) {
    if (this._e === v) return;
    this._e = v;
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
          node.__cancel(true);
          if (this.expect) {
            // before enter 事件会被立刻执行，不需要在 enter-cancelled 中取消监听。
            node.__on(BEFORE_ENTER, () => setDisplay(node.__firstDOM as HTMLElement, true), { once: true });
          } else {
            const al = () => {
              // console.log('af lv')
              setDisplay(node.__firstDOM as HTMLElement, false);
              node.__off(LEAVE_CANCELLED, lc);
            };
            const lc = () => {
              node.__off(AFTER_LEAVE, al);
            };
            node.__on(AFTER_LEAVE, al, { once: true });
            node.__on(LEAVE_CANCELLED, lc, { once: true });
          }
          node.__transition(this.expect, isFirst);
        } else {
          setDisplay(node.__firstDOM as HTMLElement, this.expect);
        }
      } else {
        setDisplay(node as HTMLElement, this.expect);
      }
    }
  }
}
