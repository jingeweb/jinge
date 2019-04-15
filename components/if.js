import {
  Component,
  RENDER,
  DESTROY,
  ARG_COMPONENTS,
  UPDATE_IF_NEED,
  UPDATE,
  ROOT_NODES,
  onAfterRender,
  getFirstHtmlDOM,
  CONTEXT
} from '../core/component';
import {
  createComment,
  getParent,
  removeChild,
  insertBefore,
  removeClass,
  removeEvent,
  addClass,
  addEvent,
  getComputedStyle,
  getCSPropertyValue
} from '../dom';
import {
  wrapAttrs
} from '../viewmodel/proxy';
import {
  STR_DEFAULT,
  STR_EMPTY,
  assert_fail,
  raf,
  createEmptyObject
} from '../util';
import {
  VM_DEBUG_NAME
} from '../viewmodel/common';

import {
  TS_STATE_ENTERED,
  TS_STATE_LEAVED,
  TS_STATE_LEAVING,
  TS_STATE_ENTERING,
  // TS_ENTER,
  // TS_LEAVE,
  // TS_TRANSITION,
  // TS_LEAVE_CANCELLED,
  // TS_ENTER_CANCELLED,
  // TS_BEFORE_ENTER,
  // TS_BEFORE_LEAVE,
  TS_TRANSITION_END,
  TS_ANIMATION_END,
  // TS_AFTER_ENTER,
  // TS_AFTER_LEAVE,
  TS_C_ENTER,
  TS_C_LEAVE,
  TS_C_ENTER_ACTIVE,
  TS_C_LEAVE_ACTIVE,
  getDurationType
} from '../core/transition';

export const IF_STR_ELSE = 'else';

const EMP_CMT = createComment(STR_EMPTY);

function createEl(renderFn, context) {
  return new Component(wrapAttrs({
    [VM_DEBUG_NAME]: 'attrs_of_<if>',
    [CONTEXT]: context,
    [ARG_COMPONENTS]: {
      [STR_DEFAULT]: renderFn
    }
  }, true));
}

export function renderSwitch(component) {
  const value = component._v;
  const acs = component[ARG_COMPONENTS];
  if (component.ts && acs) {
    const t = createEmptyObject();
    for(const k in acs) {
      t[k] = [
        k === value ? TS_STATE_ENTERED : TS_STATE_LEAVED,
        null // element
      ];
    }
    component._t = t;
    component._p = value;
    component._h = component._oe.bind(component);
  }
  const renderFn = acs ? acs[value] : null;
  const roots = component[ROOT_NODES];
  if (!renderFn) {
    roots.push(EMP_CMT);
    return roots;
  }
  const el = createEl(renderFn, component[CONTEXT]);
  roots.push(el);
  return el[RENDER]();
}

export function updateSwitch(component) {
  if (component[ROOT_NODES][0] === EMP_CMT && (
    !component[ARG_COMPONENTS] || !component[ARG_COMPONENTS][component._v]
  )) {
    return;
  }

  if (component._t) {
    return updateSwitch_ts(component);
  }
  
  doUpdate(component);
}

function doUpdate(component) {
  const roots = component[ROOT_NODES];
  const el = roots[0];
  const isC = el !== EMP_CMT;
  const fd = isC ? getFirstHtmlDOM(el) : el;
  const pa = getParent(isC ? fd : el);
  const renderFn = component[ARG_COMPONENTS] ? component[ARG_COMPONENTS][component._v] : null;
  const ne = renderFn ? createEl(renderFn, component[CONTEXT]) : null;
  roots[0] = ne || EMP_CMT;
  insertBefore(
    pa,
    ne ? ne[RENDER]() : EMP_CMT,
    fd
  );
  if (isC) {
    el[DESTROY]();
  } else {
    removeChild(pa, fd);
  }
  ne && onAfterRender(ne);
  component.notify('case-switched', component._v);
}

function cancelTs(t, tn, e, onEnd) {
  const el = t[1];
  if (el.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  removeClass(el, tn + (e ? TS_C_ENTER : TS_C_LEAVE));
  removeClass(el, tn + (e ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE));
  removeEvent(el, TS_TRANSITION_END, onEnd);
  removeEvent(el, TS_ANIMATION_END, onEnd);
}
function startTs(t, tn, e, onEnd) {
  const el = t[1];
  if (el.nodeType !== Node.ELEMENT_NODE) {
    raf(onEnd);
    return;
  }
  const class_n = tn + (e ? TS_C_ENTER : TS_C_LEAVE);
  const class_a = tn + (e ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE);

  addClass(el, class_n);
  // force render
  getCSPropertyValue(
    getComputedStyle(el),
    'width'
  );
  addClass(el, class_a);
  const t_end = getDurationType(el);
  // console.log(t_end);
  if (!t_end) {
    raf(onEnd);
    return;
  }
  t[0] = e ? TS_STATE_ENTERING : TS_STATE_LEAVING;
  addEvent(el, t_end, onEnd);
}
function updateSwitch_ts(component) {
  const value = component._v;
  const pv = component._p;
  const tn = component.ts;
  let pt = component._t[pv];
  if (!pt) {
    pt = [
      TS_STATE_ENTERED,
      null, null
    ];
    component._t[pv] = pt;
  }
  // debugger;
  if (pt[0] === TS_STATE_ENTERING) {
    if (value === pv) return;
    cancelTs(pt, tn, true, component._h);
    startTs(pt, tn, false, component._h);
  } else if (pt[0] === TS_STATE_LEAVING) {
    if (value !== pv) return;
    cancelTs(pt, tn, false, component._h);
    startTs(pt, tn, true, component._h);
  } else if (pt[0] === TS_STATE_ENTERED) {
    pt[1] = getFirstHtmlDOM(component);
    startTs(pt, tn, false, component._h);
  } else if (pt[0] === TS_STATE_LEAVED) {
    assert_fail();
  }
}

export function updateSwitch_ts_end(component) {
  // console.log('on end')
  const value = component._v;
  const pv = component._p;
  const tn = component.ts;
  const pt = component._t[pv];
  const e = pt[0] === TS_STATE_ENTERING;
  const el = pt[1];

  if (el.nodeType === Node.ELEMENT_NODE) {
    removeEvent(el, TS_TRANSITION_END, component._h);
    removeEvent(el, TS_ANIMATION_END, component._h);
    removeClass(el, tn + (e  ? TS_C_ENTER : TS_C_LEAVE));
    removeClass(el, tn + (e ? TS_C_ENTER_ACTIVE : TS_C_LEAVE_ACTIVE));
  }
  
  pt[0] = e ? TS_STATE_ENTERED : TS_STATE_LEAVED;
  
  if (e) return;

  const renderFn = component[ARG_COMPONENTS] ? component[ARG_COMPONENTS][value] : null;
  doUpdate(component, renderFn);
  component._p = value;
  const ct = component._t[value];
  const fd = getFirstHtmlDOM(component);
  if (fd === EMP_CMT) {
    ct[0] = TS_STATE_ENTERED;
    return;
  }

  ct[1] = fd; 
  startTs(ct, tn, true, component._h);
}

export class IfComponent extends Component {
  constructor(attrs) {
    super(attrs);
    this.expect = attrs.expect;
    this.ts = attrs.transition; // enable transition
    this._t = null;
    this._p = null;
    this._h = null;
  }
  get expect() {
    return this._v === STR_DEFAULT;
  }
  set expect(v) {
    v = v ? STR_DEFAULT : IF_STR_ELSE;
    if (this._v === v) return;
    this._v = v;
    this[UPDATE_IF_NEED]();
  }
  _oe() {
    updateSwitch_ts_end(this);
  }
  [RENDER]() {
    return renderSwitch(this);
  }
  [UPDATE]() {
    updateSwitch(this);
  }
}