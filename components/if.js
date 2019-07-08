import {
  Component,
  RENDER,
  DESTROY,
  ARG_COMPONENTS,
  UPDATE_IF_NEED,
  UPDATE,
  ROOT_NODES,
  HANDLE_AFTER_RENDER,
  GET_FIRST_DOM,
  CONTEXT,
  isComponent,
  GET_TRANSITION_DOM
} from '../core/component';
import {
  NOTIFY
} from '../core/messenger';
import {
  createComment,
  getParent,
  removeChild,
  insertBefore,
  removeClass,
  removeEvent,
  addClass,
  addEvent
} from '../dom';
import {
  wrapAttrs
} from '../viewmodel/proxy';
import {
  STR_DEFAULT,
  STR_EMPTY,
  raf,
  createEmptyObject,
  Symbol
} from '../util';
import {
  VM_DEBUG_NAME
} from '../viewmodel/common';

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

const IF_STR_ELSE = 'else';
const T_MAP = Symbol('transition_map');
const P_VAL = Symbol('previous_value');
const OE_H = Symbol('on_end_handler');

const C_BV = Symbol('current_branch_value');
const C_VAL = Symbol('current_value');
const ENABLE_TRANSITION = Symbol('enable_ts');
const ON_TS_END = Symbol('on_ts_end');

function createEl(renderFn, context) {
  return new Component(wrapAttrs({
    [VM_DEBUG_NAME]: 'attrs_of_<if>',
    [CONTEXT]: context,
    [ARG_COMPONENTS]: {
      [STR_DEFAULT]: renderFn
    }
  }));
}

function renderSwitch(component) {
  const value = component[C_VAL];
  const acs = component[ARG_COMPONENTS];
  if (component[ENABLE_TRANSITION] && acs) {
    const t = createEmptyObject();
    for(const k in acs) {
      t[k] = [
        k === value ? TS_STATE_ENTERED : TS_STATE_LEAVED,
        null // element
      ];
    }
    component[T_MAP] = t;
    component[P_VAL] = value;
    component[OE_H] = component[ON_TS_END].bind(component);
  }
  const renderFn = acs ? acs[value] : null;
  const roots = component[ROOT_NODES];
  if (!renderFn) {
    roots.push(createComment(STR_EMPTY));
    return roots;
  }
  const el = createEl(renderFn, component[CONTEXT]);
  roots.push(el);
  return el[RENDER]();
}

function updateSwitch(component) {
  if (!isComponent(component[ROOT_NODES][0]) && (
    !component[ARG_COMPONENTS] || !component[ARG_COMPONENTS][component[C_VAL]]
  )) {
    return;
  }

  if (component[T_MAP]) {
    return updateSwitch_ts(component);
  }
  
  doUpdate(component);
}

function doUpdate(component) {
  const roots = component[ROOT_NODES];
  const el = roots[0];
  const isC = isComponent(el);
  const fd = isC ? el[GET_FIRST_DOM]() : el;
  const pa = getParent(isC ? fd : el);
  const renderFn = component[ARG_COMPONENTS] ? component[ARG_COMPONENTS][component[C_VAL]] : null;
  const ne = renderFn ? createEl(renderFn, component[CONTEXT]) : null;
  roots[0] = ne || createComment(STR_EMPTY);
  insertBefore(
    pa,
    ne ? ne[RENDER]() : roots[0],
    fd
  );
  if (isC) {
    el[DESTROY]();
  } else {
    removeChild(pa, fd);
  }
  ne && renderFn && ne[HANDLE_AFTER_RENDER]();
  component[NOTIFY]('branch-switched', component[C_BV]);
}

function cancelTs(t, tn, e, component) {
  const el = t[1];
  if (el.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  const onEnd = component[OE_H];
  removeClass(el, tn + (e ? TS_C_ENTER : TS_C_LEAVE));
  removeClass(el, tn + (e ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE));
  removeEvent(el, TS_TRANSITION_END, onEnd);
  removeEvent(el, TS_ANIMATION_END, onEnd);
  component[NOTIFY](TS_TRANSITION, e ? TS_ENTER_CANCELLED : TS_LEAVE_CANCELLED, el);
}

function startTs(t, tn, e, component) {
  const el = t[1];
  const onEnd = component[OE_H];
  if (el.nodeType !== Node.ELEMENT_NODE) {
    raf(onEnd);
    return;
  }
  const class_n = tn + (e ? TS_C_ENTER : TS_C_LEAVE);
  const class_a = tn + (e ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE);

  addClass(el, class_n);
  // force render by calling getComputedStyle
  getDurationType(el);
  addClass(el, class_a);
  const t_end = getDurationType(el);
  if (!t_end) {
    raf(onEnd);
    return;
  }
  t[0] = e ? TS_STATE_ENTERING : TS_STATE_LEAVING;
  addEvent(el, t_end, onEnd);
  component[NOTIFY](TS_TRANSITION, e ? TS_BEFORE_ENTER : TS_BEFORE_LEAVE, el);
  raf(() => {
    component[NOTIFY](TS_TRANSITION, e ? TS_ENTER : TS_LEAVE, el);
  });
}
function updateSwitch_ts(component) {
  const value = component[C_VAL];
  const pv = component[P_VAL];
  const tn = component[ENABLE_TRANSITION];
  let pt = component[T_MAP][pv];
  if (!pt) {
    pt = [
      pv === IF_STR_ELSE ? TS_STATE_LEAVED : TS_STATE_ENTERED,
      null, null
    ];
    component[T_MAP][pv] = pt;
  }
  // debugger;
  if (pt[0] === TS_STATE_ENTERING) {
    if (value === pv) return;
    cancelTs(pt, tn, true, component);
    startTs(pt, tn, false, component);
  } else if (pt[0] === TS_STATE_LEAVING) {
    if (value !== pv) return;
    cancelTs(pt, tn, false, component);
    startTs(pt, tn, true, component);
  } else if (pt[0] === TS_STATE_ENTERED) {
    pt[1] = component[GET_TRANSITION_DOM]();
    startTs(pt, tn, false, component);
  } else if (pt[0] === TS_STATE_LEAVED) {
    pt[1] = component[GET_TRANSITION_DOM]();
    startTs(pt, tn, true, component);
  }
}

function updateSwitch_ts_end(component) {
  // console.log('on end')
  const value = component[C_VAL];
  const pv = component[P_VAL];
  const tn = component[ENABLE_TRANSITION];
  const pt = component[T_MAP][pv];
  const e = pt[0] === TS_STATE_ENTERING;
  const el = pt[1];

  if (el.nodeType === Node.ELEMENT_NODE) {
    removeEvent(el, TS_TRANSITION_END, component[OE_H]);
    removeEvent(el, TS_ANIMATION_END, component[OE_H]);
    removeClass(el, tn + (e  ? TS_C_ENTER : TS_C_LEAVE));
    removeClass(el, tn + (e ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE));
    component[NOTIFY](TS_TRANSITION, e ? TS_AFTER_ENTER : TS_AFTER_LEAVE);
  }
  
  pt[0] = e ? TS_STATE_ENTERED : TS_STATE_LEAVED;
  
  if (e) return;

  const renderFn = component[ARG_COMPONENTS] ? component[ARG_COMPONENTS][value] : null;
  doUpdate(component, renderFn);
  component[P_VAL] = value;
  const ct = component[T_MAP][value];
  const fd = component[GET_TRANSITION_DOM]();
  if (fd.nodeType !== Node.ELEMENT_NODE) {
    ct[0] = TS_STATE_ENTERED;
    return;
  }

  ct[1] = fd; 
  startTs(ct, tn, true, component);
}

export class IfComponent extends Component {
  constructor(attrs) {
    super(attrs);
    this.e = attrs.expect;
    this[ENABLE_TRANSITION] = attrs.transition; // enable transition
  }
  get e() {
    return this[C_VAL] === STR_DEFAULT;
  }
  set e(v) {
    v = v ? STR_DEFAULT : IF_STR_ELSE;
    if (this[C_VAL] === v) return;
    this[C_VAL] = v;
    this[UPDATE_IF_NEED]();
  }
  get [C_BV]() {
    return this.e;
  }
  [ON_TS_END]() {
    updateSwitch_ts_end(this);
  }
  [RENDER]() {
    return renderSwitch(this);
  }
  [UPDATE]() {
    updateSwitch(this);
  }
}

export class SwitchComponent extends Component {
  constructor(attrs) {
    super(attrs);
    this.t = attrs.test;
    this[ENABLE_TRANSITION] = attrs.transition; // enable transition
  }
  get t() {
    return this[C_VAL];
  }
  set t(v) {
    const acs = this[ARG_COMPONENTS];
    if (!acs || !(v in acs)) {
      v = STR_DEFAULT;
    }
    if (this[C_VAL] === v) return;
    this[C_VAL] = v;
    this[UPDATE_IF_NEED]();
  }
  get [C_BV]() {
    return this.t;
  }
  [ON_TS_END]() {
    updateSwitch_ts_end(this);
  }
  [RENDER]() {
    return renderSwitch(this);
  }
  [UPDATE]() {
    updateSwitch(this);
  }
}