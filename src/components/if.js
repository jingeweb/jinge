import {
  Component,
  RENDER,
  DESTROY,
  ARG_COMPONENTS,
  UPDATE_IF_NEED,
  UPDATE,
  ROOT_NODES,
  onAfterRender
} from '../core/component';
import {
  createComment,
  insertAfter,
  getParent
} from '../dom';
import {
  Symbol, STR_DEFAULT
} from '../util';

export const IS_RENDERED = Symbol('is_rendered');
export const COMMENT_ELE = Symbol('comment_ele');

export class IfComponent extends Component {
  constructor(attrs) {
    super(attrs);
    this[COMMENT_ELE] = null;
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
    const roots = this[ROOT_NODES];
    const $comment = createComment(' <if> ');
    roots.push($comment);
    const renderFn = this[ARG_COMPONENTS] ? this[ARG_COMPONENTS][this.expect ? STR_DEFAULT : 'else'] : null;
    if (!renderFn) return roots;
    const el = new Component(renderFn);
    roots.push(el);
    return [$comment, ...el[RENDER]()];
  }
  [UPDATE]() {
    const roots = this[ROOT_NODES];
    const old = roots.length === 2 ? roots.pop() : null;
    if (old) {
      old[DESTROY]();
    }
    const renderFn = this[ARG_COMPONENTS] ? this[ARG_COMPONENTS][this.expect ? STR_DEFAULT : 'else'] : null;
    if (!renderFn) return;
    const el = new Component(renderFn);
    roots.push(el);
    insertAfter(
      getParent(roots[0]),
      el[RENDER](),
      roots[0]
    );
    onAfterRender(el);
  }
}