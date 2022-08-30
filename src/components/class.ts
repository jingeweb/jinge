import { Component, Attributes } from '../core/component';
import { removeEvent, addEvent, setImmediate, setAttribute } from '../util';
import { TransitionStates, getDurationType } from '../core/transition';
import { $$ } from '../vm';

enum ClassOpType {
  ADD,
  DEL,
}

export interface ToggleClassComponentAttrs {
  /** 是否开启动画切换，默认为 true。
   * 通常不需要指定为 false，因为如果不需要动画能力，则不需要使用 toggle-class 组件包裹，
   * 直接配置 dom 元素的 :class 属性即可。
   */
  transition?: boolean;
}

/**
 * 带有 transition 能力的切换 dom class 的组件。
 */
export class ToggleClassComponent extends Component {
  _ts: Map<string, [TransitionStates, EventListener]>;
  /** old class list set */
  _cs: Set<string>;
  /** enable transition */
  transition: boolean;

  constructor(attrs: Attributes<ToggleClassComponentAttrs>) {
    super(attrs);
    this.transition = attrs.transition !== false;
    this[$$].__watch('class', () => {
      this.__updateIfNeed();
    });
  }

  __render() {
    const rr = super.__render();
    this.__update(true);
    return rr;
  }

  __beforeDestroy() {
    this._ts = null; // maybe unnecessary
  }

  __update(first: boolean) {
    const el = this.__transitionDOM as HTMLElement;
    if (el && el.nodeType !== Node.ELEMENT_NODE) {
      // ignore comment or text-node
      return;
    }

    if (!this.transition) {
      setAttribute(el, 'class', this.class);
      return;
    }

    if (!this._ts) {
      this._ts = new Map();
    }

    const newClassList = new Set(this.class ? (this.class as string).split(' ') : []);
    if (first) {
      // 初始化首次渲染，暂不支持 transition 动画。TODO: 支持页面初始渲染时的切入动画。
      newClassList.forEach((clz) => {
        this._ts.set(clz, [TransitionStates.ENTERED, null]);
        el.classList.add(clz);
      });
      this._cs = newClassList;
      return;
    }

    const preClassList = this._cs;
    const diffClassList: {
      className: string;
      type: ClassOpType;
    }[] = [];
    newClassList.forEach((clz) => {
      if (preClassList.has(clz)) {
        preClassList.delete(clz); // 删除已经存在的，剩下的就是待从原来的 classList 中移除的 className
      } else {
        diffClassList.push({ className: clz, type: ClassOpType.ADD });
      }
    });
    preClassList.forEach((clz) => {
      diffClassList.push({ className: clz, type: ClassOpType.DEL });
    });
    this._cs = newClassList;

    if (diffClassList.length === 0) {
      return;
    }

    diffClassList.forEach(({ className, type }) => {
      const isAdd = type === ClassOpType.ADD;
      let t = this._ts.get(className);
      if (!t) {
        t = [isAdd ? TransitionStates.LEAVED : TransitionStates.ENTERED, null];
        this._ts.set(className, t);
      }
      if ((isAdd && t[0] <= TransitionStates.ENTERED) || (!isAdd && t[0] >= TransitionStates.LEAVING)) {
        return;
      }

      if (t && t[0] === (isAdd ? TransitionStates.LEAVING : TransitionStates.ENTERING)) {
        el.classList.remove(className + (isAdd ? '-leave-active' : '-enter-active'));
        el.classList.remove(className + (isAdd ? '-leave' : '-enter'));

        removeEvent(el, 'transitionend', t[1]);
        removeEvent(el, 'animationend', t[1]);
        t[1] = null;
        this.__notify('transition', isAdd ? 'leave-cancelled' : 'enter-cancelled', className, el);
      }
      const classOfStart = className + (isAdd ? '-enter' : '-leave');
      const classOfActive = className + (isAdd ? '-enter-active' : '-leave-active');
      el.classList.add(classOfStart);
      // force render by calling getComputedStyle
      getDurationType(el);
      el.classList.add(classOfActive);
      const tsEndName = getDurationType(el);
      if (!tsEndName) {
        el.classList.remove(classOfStart);
        el.classList.remove(classOfActive);
        t[0] = isAdd ? TransitionStates.ENTERED : TransitionStates.LEAVED;
        if (isAdd) {
          el.classList.add(className);
        } else {
          el.classList.remove(className);
        }
        return;
      }
      const onEnd = (): void => {
        removeEvent(el, 'transitionend', onEnd);
        removeEvent(el, 'animationend', onEnd);
        el.classList.remove(classOfStart);
        el.classList.remove(classOfActive);
        t[1] = null;
        t[0] = isAdd ? TransitionStates.ENTERED : TransitionStates.LEAVED;
        if (isAdd) {
          el.classList.add(className);
        } else {
          el.classList.remove(className);
        }
        this.__notify('transition', isAdd ? 'after-enter' : 'after-leave', className, el);
      };
      t[0] = isAdd ? TransitionStates.ENTERING : TransitionStates.LEAVING;
      t[1] = onEnd;
      addEvent(el, tsEndName, onEnd);
      this.__notify('transition', isAdd ? 'before-enter' : 'before-leave', className, el);
      setImmediate(() => {
        this.__notify('transition', isAdd ? 'enter' : 'leave', className, el);
      });
    });
  }
}
