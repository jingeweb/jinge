import {
  Component,
  RENDER,
  ARG_COMPONENTS,
  UPDATE_IF_NEED,
  UPDATE,
  ROOT_NODES,
} from '../core/component';
import {
  createElementWithoutAttrs,
  getParent,
  removeChild,
  createComment,
  insertBefore
} from '../dom';
import {
  STR_EMPTY
} from '../util';

function renderHtml(content) {
  const $d = createElementWithoutAttrs('div');
  $d.innerHTML = content || '';
  let cn = $d.childNodes;
  if (cn.length === 0) {
    cn = [createComment(STR_EMPTY)];
  } else {
    cn = [].slice.call(cn); // convert NodeList to Array.
  }
  return cn;
}

export class BindHtmlComponent extends Component {
  constructor(attrs) {
    if (attrs[ARG_COMPONENTS]) throw new Error('<bind-html/> don\'t accept any child.');
    if (!('content' in attrs)) throw new Error('<bind-html/> require "content" attribute');
    super(attrs);
    this.c = attrs.content;
  }
  get c() {
    return this._c;
  }
  set c(v) {
    if (this._c === v) return;
    this._c = v;
    this[UPDATE_IF_NEED]();
  }
  [RENDER]() {
    return (this[ROOT_NODES] = renderHtml(this._c));
  }
  [UPDATE]() {
    const roots = this[ROOT_NODES];
    const oldFirstEl = roots[0];
    const $p = getParent(oldFirstEl);
    const newEls = renderHtml(this._c);
    insertBefore($p, newEls, oldFirstEl);
    roots.forEach(oldEl => removeChild($p, oldEl));
    this[ROOT_NODES] = newEls;
  }
}