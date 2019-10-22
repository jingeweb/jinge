import {
  Component,
  RENDER,
  UPDATE,
  GET_TRANSITION_DOM,
  operateRootHtmlDOM,
  UPDATE_IF_NEED,
  BEFORE_DESTROY
} from '../core/component';
import {
  addClass,
  removeClass,
  addEvent,
  removeEvent
} from '../dom';
import {
  isObject,
  setImmediate
} from '../util';
import {
  vmWatch
} from '../viewmodel/core';
import {
  NOTIFY
} from '../core/messenger';
import {
  TS_STATE_ENTERED,
  TS_STATE_LEAVED,
  TS_STATE_LEAVING,
  TS_STATE_ENTERING,
  TS_ENTER,
  TS_LEAVE,
  TS_TRANSITION,
  TS_LEAVE_CANCELLED,
  TS_ENTER_CANCELLED,
  TS_BEFORE_ENTER,
  TS_BEFORE_LEAVE,
  TS_TRANSITION_END,
  TS_ANIMATION_END,
  TS_AFTER_ENTER,
  TS_AFTER_LEAVE,
  TS_C_ENTER,
  TS_C_LEAVE,
  TS_C_ENTER_ACTIVE,
  TS_C_LEAVE_ACTIVE,
  getDurationType
} from '../core/transition';

export class ToggleClassComponent extends Component {
  constructor(attrs) {
    if (!attrs || !isObject(attrs.class)) {
      throw new Error('<toggle-class> component require "class" attribute to be Object.');
    }
    super(attrs);
    this.class = attrs.class;
    this.trans = !!attrs.transition;
    this._t = null;
    this._i = null; // update immediate
    vmWatch(this, 'class.**', () => {
      this[UPDATE_IF_NEED]();
    });
  }

  [RENDER]() {
    const rr = super[RENDER]();
    this[UPDATE](true);
    return rr;
  }

  [BEFORE_DESTROY]() {
    this._t && this._t.clear();
  }

  [UPDATE](init) {
    const el = this.trans ? this[GET_TRANSITION_DOM]() : this;
    if (el.nodeType !== Node.ELEMENT_NODE) {
      // ignore comment or text-node
      return;
    }
    if (this.trans && !this._t) {
      this._t = new Map();
    }
    const cs = this.class;
    Object.keys(cs).forEach(k => {
      const v = cs[k];
      if (!this.trans) {
        operateRootHtmlDOM(
          v ? addClass : removeClass,
          el, k
        );
        return;
      }

      if (init) {
        this._t.set(k, [
          v ? TS_STATE_ENTERED : TS_STATE_LEAVED, // state
          null // saved onEnd callback
        ]);
        v ? addClass(el, k) : removeClass(el, k);
        return;
      }

      const t = this._t.get(k);
      if (!t) {
        console.error('Unsupport <toogle-class> attribute. see https://todo');
        return;
      }
      const s = t[0];
      if ((v && s <= TS_STATE_ENTERED) || (!v && s >= TS_STATE_LEAVING)) {
        return;
      }

      if (s === (v ? TS_STATE_LEAVING : TS_STATE_ENTERING)) {
        // debugger;
        removeClass(el, k + (v ? TS_C_LEAVE : TS_C_ENTER));
        removeClass(el, k + (v ? TS_C_LEAVE_ACTIVE : TS_C_ENTER_ACTIVE));
        removeEvent(el, TS_TRANSITION_END, t[1]);
        removeEvent(el, TS_ANIMATION_END, t[1]);
        t[1] = null;
        this[NOTIFY](TS_TRANSITION, v ? TS_LEAVE_CANCELLED : TS_ENTER_CANCELLED, k, el);
      }
      const classOfStart = k + (v ? TS_C_ENTER : TS_C_LEAVE);
      const classOfActive = k + (v ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE);
      addClass(el, classOfStart);
      // force render by calling getComputedStyle
      getDurationType(el);
      addClass(el, classOfActive);
      const tsEndName = getDurationType(el);
      if (!tsEndName) {
        removeClass(el, classOfStart);
        removeClass(el, classOfActive);
        t[0] = v ? TS_STATE_ENTERED : TS_STATE_LEAVED;
        v ? addClass(el, k) : removeClass(el, k);
        return;
      }
      const onEnd = () => {
        removeEvent(el, TS_TRANSITION_END, onEnd);
        removeEvent(el, TS_ANIMATION_END, onEnd);
        removeClass(el, classOfStart);
        removeClass(el, classOfActive);
        t[1] = null;
        t[0] = v ? TS_STATE_ENTERED : TS_STATE_LEAVED;
        v ? addClass(el, k) : removeClass(el, k);
        this[NOTIFY](TS_TRANSITION, v ? TS_AFTER_ENTER : TS_AFTER_LEAVE, k, el);
      };
      t[0] = v ? TS_STATE_ENTERING : TS_STATE_LEAVING;
      t[1] = onEnd;
      addEvent(el, tsEndName, onEnd);
      this[NOTIFY](TS_TRANSITION, v ? TS_BEFORE_ENTER : TS_BEFORE_LEAVE, k, el);
      setImmediate(() => {
        this[NOTIFY](TS_TRANSITION, v ? TS_ENTER : TS_LEAVE, k, el);
      });
    });
  }
}
