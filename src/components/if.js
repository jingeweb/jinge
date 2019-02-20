import {
  Component,
  RENDER,
  DESTROY,
  ARG_COMPONENTS,
  UPDATE_IF_NEED,
  UPDATE,
  ROOT_NODES,
  onAfterRender,
  isComponent,
  getFirstHtmlDOM,
  CONTEXT
} from '../core/component';
import {
  createComment,
  getParent,
  removeChild,
  insertBefore
} from '../dom';
import {
  wrapViewModel
} from '../viewmodel/proxy';
import {
  STR_DEFAULT,
  STR_EMPTY
} from '../util';


function getRenderFn(acs, value) {
  return acs ? ((value in acs) ? acs[value] : acs[STR_DEFAULT]) : null;
}

function createEl(renderFn, context) {
  return new Component(wrapViewModel({
    [CONTEXT]: context,
    [ARG_COMPONENTS]: {
      [STR_DEFAULT]: renderFn
    }
  }, true));
}

export function renderSwitch(acs, roots, value, context) {
  const renderFn = getRenderFn(acs, value);
  if (!renderFn) {
    roots.push(createComment(STR_EMPTY));
    return roots;
  }
  const el = createEl(renderFn, context);
  roots.push(el);
  return el[RENDER]();
}


export function updateSwitch(acs, roots, value, context) {
  const renderFn = getRenderFn(acs, value);
  if (!renderFn) {
    const el = roots[0];
    if (isComponent(el)) {
      const fd = getFirstHtmlDOM(el);
      const pa = getParent(fd);
      const $cmt = createComment(STR_EMPTY);
      roots[0] = $cmt;
      insertBefore(
        pa,
        $cmt,
        fd
      );
      el[DESTROY]();
    }
    return;
  }

  const el = roots[0];
  let fd, pa;
  const isC = isComponent(el);
  if (isC) {
    fd = getFirstHtmlDOM(el);
    pa = getParent(fd);
  } else {
    fd = el;
    pa = getParent(el);
  }
  const ne = createEl(renderFn, context);
  roots[0] = ne;
  insertBefore(
    pa,
    ne[RENDER](),
    fd
  );
  if (isC) {
    el[DESTROY]();
  } else {
    removeChild(pa, fd);
  }
  onAfterRender(ne);
}

export class IfComponent extends Component {
  constructor(attrs) {
    super(attrs);
    this.expect = !!attrs.expect;
  }
  get expect() {
    return this._e;
  }
  set expect(v) {
    if (this._e === v) return;
    this._e = v;
    this[UPDATE_IF_NEED]();
  }
  [RENDER]() {
    const acs = this[ARG_COMPONENTS];
    if (acs) {
      acs[false] = acs['else'];
    }
    return renderSwitch(acs, this[ROOT_NODES], this.expect, this[CONTEXT]);
  }
  [UPDATE]() {
    updateSwitch(this[ARG_COMPONENTS], this[ROOT_NODES], this.expect, this[CONTEXT]);
  }
}