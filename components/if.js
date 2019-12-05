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
  GET_TRANSITION_DOM,
  BEFORE_DESTROY,
  NOTIFY,
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
  getDurationType,
  addParentStyleId,
  CSTYLE_PID
} from '../core';
import {
  createComment,
  getParent,
  removeChild,
  insertBefore,
  removeClass,
  removeEvent,
  addClass,
  addEvent,
  STR_DEFAULT,
  STR_EMPTY,
  Symbol,
  setImmediate
} from '../util';
import {
  wrapAttrs,
  VM_DEBUG_NAME,
  VM_ATTRS
} from '../vm';

const IF_STR_ELSE = 'else';
const T_MAP = Symbol('transition_map');
const P_VAL = Symbol('previous_value');
const OE_H = Symbol('on_end_handler');

const C_BV = Symbol('current_branch_value');
const C_VAL = Symbol('current_value');
const ON_TS_END = Symbol('on_ts_end');

function createEl(renderFn, context, parentStyleIds) {
  const el = new Component(wrapAttrs({
    [VM_DEBUG_NAME]: 'attrs_of_<if>',
    [VM_ATTRS]: null,
    [CONTEXT]: context,
    [ARG_COMPONENTS]: {
      [STR_DEFAULT]: renderFn
    }
  }));
  parentStyleIds && addParentStyleId(el, parentStyleIds);
  return el;
}

function renderSwitch(component) {
  const value = component[C_VAL];
  const acs = component[ARG_COMPONENTS];
  if (component.ts && acs) {
    const t = new Map();
    for (const k in acs) {
      t.set(k, [
        k === value ? TS_STATE_ENTERED : TS_STATE_LEAVED,
        null // element
      ]);
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
  const el = createEl(renderFn, component[CONTEXT], component[CSTYLE_PID]);
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
    return updateSwitchWithTransition(component);
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
  const ne = renderFn ? createEl(renderFn, component[CONTEXT], component[CSTYLE_PID]) : null;
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
    onEnd();
    return;
  }
  const classOfStart = tn + (e ? TS_C_ENTER : TS_C_LEAVE);
  const classOfActive = tn + (e ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE);

  addClass(el, classOfStart);
  // force render by calling getComputedStyle
  getDurationType(el);
  addClass(el, classOfActive);
  const tsEndName = getDurationType(el);
  if (!tsEndName) {
    onEnd();
    return;
  }
  t[0] = e ? TS_STATE_ENTERING : TS_STATE_LEAVING;
  addEvent(el, tsEndName, onEnd);
  component[NOTIFY](TS_TRANSITION, e ? TS_BEFORE_ENTER : TS_BEFORE_LEAVE, el);
  setImmediate(() => {
    component[NOTIFY](TS_TRANSITION, e ? TS_ENTER : TS_LEAVE, el);
  });
}
function updateSwitchWithTransition(component) {
  const value = component[C_VAL];
  const pv = component[P_VAL];
  const tn = component.ts;
  let pt = component[T_MAP].get(pv);
  if (!pt) {
    pt = [
      pv === IF_STR_ELSE ? TS_STATE_LEAVED : TS_STATE_ENTERED,
      null // element
    ];
    component[T_MAP].set(pv, pt);
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

function updateSwitchOnTransitionEnd(component) {
  // console.log('on end')
  const value = component[C_VAL];
  const pv = component[P_VAL];
  const tn = component.ts;
  const pt = component[T_MAP].get(pv);
  const e = pt[0] === TS_STATE_ENTERING;
  const el = pt[1];

  if (el.nodeType === Node.ELEMENT_NODE) {
    removeEvent(el, TS_TRANSITION_END, component[OE_H]);
    removeEvent(el, TS_ANIMATION_END, component[OE_H]);
    removeClass(el, tn + (e ? TS_C_ENTER : TS_C_LEAVE));
    removeClass(el, tn + (e ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE));
    component[NOTIFY](TS_TRANSITION, e ? TS_AFTER_ENTER : TS_AFTER_LEAVE);
  }

  pt[0] = e ? TS_STATE_ENTERED : TS_STATE_LEAVED;

  if (e) return;

  doUpdate(component);
  component[P_VAL] = value;
  const ct = component[T_MAP].get(value);
  if (!ct) {
    return;
  }
  const fd = component[GET_TRANSITION_DOM]();
  if (fd.nodeType !== Node.ELEMENT_NODE) {
    ct[0] = TS_STATE_ENTERED;
    return;
  }

  ct[1] = fd;
  startTs(ct, tn, true, component);
}

function destroySwitch(component) {
  const tMap = component[T_MAP];
  if (tMap) {
    tMap.forEach((ts, v) => {
      if (ts[1]) {
        removeEvent(ts[1], TS_TRANSITION_END, component[OE_H]);
        removeEvent(ts[1], TS_ANIMATION_END, component[OE_H]);
      }
      ts.length = 0;
    });
    tMap.clear();
  }
}

export class IfComponent extends Component {
  constructor(attrs) {
    super(attrs);

    this[C_VAL] = STR_DEFAULT;
    this[OE_H] = null;
    this[T_MAP] = null;
    this[P_VAL] = null;

    this.expect = attrs.expect;
    this.ts = attrs.transition;
  }

  get expect() {
    return this[C_VAL] === STR_DEFAULT;
  }

  set expect(v) {
    v = v ? STR_DEFAULT : IF_STR_ELSE;
    if (this[C_VAL] === v) return;
    this[C_VAL] = v;
    this[UPDATE_IF_NEED]();
  }

  get [C_BV]() {
    return this.expect;
  }

  [ON_TS_END]() {
    updateSwitchOnTransitionEnd(this);
  }

  [RENDER]() {
    return renderSwitch(this);
  }

  [UPDATE]() {
    updateSwitch(this);
  }

  [BEFORE_DESTROY]() {
    destroySwitch(this);
  }
}

export class SwitchComponent extends Component {
  constructor(attrs) {
    super(attrs);

    this[OE_H] = null;
    this[T_MAP] = null;
    this[P_VAL] = null;

    this.test = attrs.test;
    this.ts = attrs.transition;
  }

  get test() {
    return this[C_VAL];
  }

  set test(v) {
    const acs = this[ARG_COMPONENTS];
    if (!acs || !(v in acs)) {
      v = STR_DEFAULT;
    }
    if (this[C_VAL] === v) return;
    this[C_VAL] = v;
    this[UPDATE_IF_NEED]();
  }

  get [C_BV]() {
    return this.test;
  }

  [ON_TS_END]() {
    updateSwitchOnTransitionEnd(this);
  }

  [RENDER]() {
    return renderSwitch(this);
  }

  [UPDATE]() {
    updateSwitch(this);
  }

  [BEFORE_DESTROY]() {
    destroySwitch(this);
  }
}
