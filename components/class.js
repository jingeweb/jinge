import {
  Component,
  RENDER,
  UPDATE,
  STATE_RENDERED,
  STATE,
  getFirstHtmlDOM,
  operateRootHtmlDOM
} from '../core/component';
import {
  addClass,
  removeClass,
  addEvent,
  removeEvent,
  getCSPropertyValue
} from '../dom';
import {
  isObject,
  setImmediate,
  clearImmediate,
  raf,
  caf
} from '../util';
import {
  vmWatch,
  vmUnwatch
} from '../viewmodel/notify';
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
      if (this[STATE] !== STATE_RENDERED) return;
      if (this._i) clearImmediate(this._i);
      this._i = setImmediate(() => {
        this._i = null;
        this[UPDATE]();
      });
    });
  }
  beforeDestroy() {
    vmUnwatch(this, 'class.**');
  }
  [RENDER]() {
    const rr = super[RENDER]();
    this[UPDATE](true);
    return rr;
  }
  [UPDATE](init) {
    const el = this.trans ? getFirstHtmlDOM(this) : this;
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
          null,  // saved raf 
          null   // saved onEnd callback
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
      if (v && s <= TS_STATE_ENTERED || !v && s >= TS_STATE_LEAVING) {
        return;
      }

      if (s === (v ? TS_STATE_LEAVING : TS_STATE_ENTERING)) {
        // debugger;
        removeClass(el, k + (v ? TS_C_LEAVE : TS_C_ENTER));
        removeClass(el, k + (v ? TS_C_LEAVE_ACTIVE : TS_C_ENTER_ACTIVE));
        if (t[1]) {
          caf(t[1]);
        } else {
          removeEvent(el, TS_TRANSITION_END, t[2]);
          removeEvent(el, TS_ANIMATION_END, t[2]);
        }
        this.notify(TS_TRANSITION, v ? TS_LEAVE_CANCELLED : TS_ENTER_CANCELLED, k, el);
      }
      addClass(el, k + (v ? TS_C_ENTER : TS_C_LEAVE));
      // force render
      getCSPropertyValue(
        getComputedStyle(el),
        'width'
      );
      addClass(el, k + (v ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE));
      const t_end = getDurationType(el);        
      console.log(t_end);
      if (!t_end) {
        removeClass(el, k + (v  ? TS_C_ENTER : TS_C_LEAVE));
        t[0] = v ? TS_STATE_ENTERED : TS_STATE_LEAVED;
        v ? addClass(el, k) : removeClass(el, k);
        return;
      }
      this.notify(TS_TRANSITION, v ? TS_BEFORE_ENTER : TS_BEFORE_LEAVE, k, el);
      t[0] = v ? TS_STATE_ENTERING : TS_STATE_LEAVING;
      const onEnd = () => {
        removeEvent(el, TS_TRANSITION_END, onEnd);
        removeEvent(el, TS_ANIMATION_END, onEnd);
        removeClass(el, k + (v  ? TS_C_ENTER : TS_C_LEAVE));
        removeClass(el, k + (v ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE));
        t[2] = null;
        t[0] = v ? TS_STATE_ENTERED : TS_STATE_LEAVED;
        v ? addClass(el, k) : removeClass(el, k);
        this.notify(TS_TRANSITION, v ? TS_AFTER_ENTER : TS_AFTER_LEAVE, k, el);
      };
      t[2] = onEnd;
      addEvent(el, t_end, onEnd);
      raf(() => {
        this.notify(TS_TRANSITION, v ? TS_ENTER : TS_LEAVE, k, el);
      });
      // this.notify(TS_TRANSITION, v ? TS_ENTER : TS_LEAVE, k, el);
      // addEvent(el, t_end, onEnd);
      // addClass(el, k + (v ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE));
      // t[1] = raf(() => {
      //   t[1] = null;
      //   const onEnd = () => {
      //     removeEvent(el, TS_TRANSITION_END, onEnd);
      //     removeEvent(el, TS_ANIMATION_END, onEnd);
      //     removeClass(el, k + (v  ? TS_C_ENTER : TS_C_LEAVE));
      //     removeClass(el, k + (v ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE));
      //     t[2] = null;
      //     t[0] = v ? TS_STATE_ENTERED : TS_STATE_LEAVED;
      //     v ? addClass(el, k) : removeClass(el, k);
      //     this.notify(TS_TRANSITION, v ? TS_AFTER_ENTER : TS_AFTER_LEAVE, k, el);
      //   };
      //   t[2] = onEnd;
      //   this.notify(TS_TRANSITION, v ? TS_ENTER : TS_LEAVE, k, el);
      //   addEvent(el, TS_TRANSITION_END, onEnd);
      //   addEvent(el, TS_ANIMATION_END, onEnd);
      //   addClass(el, k + (v ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE));
      // });
    });
  }
}