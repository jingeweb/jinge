import { Component, __, ComponentAttributes, isComponent } from '../core/component';
import { isObject, removeEvent, addEvent, setImmediate } from '../util';
import { $$ } from '../vm/common';
import { TransitionStates, getDurationType } from '../core/transition';

function loopOperateClass(el: Component | Node, isAddOperate: boolean, domClass: string): void {
  if (isComponent(el)) {
    (el as Component)[__].rootNodes.forEach((ce) => loopOperateClass(ce, isAddOperate, domClass));
  } else if (isAddOperate) {
    (el as HTMLElement).classList.add(domClass);
  } else {
    (el as HTMLElement).classList.remove(domClass);
  }
}

export class ToggleClassComponent extends Component {
  domClass: Record<string, boolean>;
  transition: boolean;
  _t: Map<string, [TransitionStates, EventListener]>;
  _i: number;

  constructor(attrs: ComponentAttributes) {
    if (!attrs || !isObject(attrs.class)) {
      throw new Error('<toggle-class> component require "class" attribute to be Object.');
    }
    super(attrs);
    this.domClass = attrs.class as Record<string, boolean>;
    this.transition = !!attrs.transition;

    this._t = null;
    this._i = -1; // update immediate
    this[$$].__watch('domClass.**', () => {
      this.__updateIfNeed();
    });
  }

  __render(): Node[] {
    const rr = super.__render();
    this.__update(true);
    return rr;
  }

  __beforeDestroy(): void {
    this._t = null; // maybe unnecessary
  }

  __update(first: boolean): void {
    const el = this.transition ? (this.__transitionDOM as HTMLElement) : null;
    if (el && el.nodeType !== Node.ELEMENT_NODE) {
      // ignore comment or text-node
      return;
    }
    if (this.transition && !this._t) {
      this._t = new Map();
    }
    const cs = this.domClass;
    Object.keys(cs).forEach((k) => {
      const v = cs[k];
      if (!this.transition) {
        loopOperateClass(this as unknown as Component, !!v, k);
        return;
      }

      if (first) {
        this._t.set(k, [
          v ? TransitionStates.ENTERED : TransitionStates.LEAVED, // state
          null, // saved onEnd callback
        ]);
        if (v) {
          el.classList.add(k);
        } else {
          el.classList.remove(k);
        }
        return;
      }

      const t = this._t.get(k);
      if (!t) {
        // eslint-disable-next-line no-console
        console.error('Unsupport <toogle-class> attribute. see https://todo');
        return;
      }
      const s = t[0];
      if ((v && s <= TransitionStates.ENTERED) || (!v && s >= TransitionStates.LEAVING)) {
        return;
      }

      if (s === (v ? TransitionStates.LEAVING : TransitionStates.ENTERING)) {
        el.classList.remove(k + (v ? '-leave-active' : '-enter-active'));
        el.classList.remove(k + (v ? '-leave' : '-enter'));

        removeEvent(el, 'transitionend', t[1]);
        removeEvent(el, 'animationend', t[1]);
        t[1] = null;
        this.__notify('transition', v ? 'leave-cancelled' : 'enter-cancelled', k, el);
      }
      const classOfStart = k + (v ? '-enter' : '-leave');
      const classOfActive = k + (v ? '-enter-active' : '-leave-active');
      el.classList.add(classOfStart);
      // force render by calling getComputedStyle
      getDurationType(el);
      el.classList.add(classOfActive);
      const tsEndName = getDurationType(el);
      if (!tsEndName) {
        el.classList.remove(classOfStart);
        el.classList.remove(classOfActive);
        t[0] = v ? TransitionStates.ENTERED : TransitionStates.LEAVED;
        if (v) {
          el.classList.add(k);
        } else {
          el.classList.remove(k);
        }
        return;
      }
      const onEnd = (): void => {
        removeEvent(el, 'transitionend', onEnd);
        removeEvent(el, 'animationend', onEnd);
        el.classList.remove(classOfStart);
        el.classList.remove(classOfActive);
        t[1] = null;
        t[0] = v ? TransitionStates.ENTERED : TransitionStates.LEAVED;
        if (v) {
          el.classList.add(k);
        } else {
          el.classList.remove(k);
        }
        this.__notify('transition', v ? 'after-enter' : 'after-leave', k, el);
      };
      t[0] = v ? TransitionStates.ENTERING : TransitionStates.LEAVING;
      t[1] = onEnd;
      addEvent(el, tsEndName, onEnd);
      this.__notify('transition', v ? 'before-enter' : 'before-leave', k, el);
      setImmediate(() => {
        this.__notify('transition', v ? 'enter' : 'leave', k, el);
      });
    });
  }
}
