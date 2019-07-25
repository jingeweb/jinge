import {
  Component,
  RENDER
} from '../core/component.js';
import {
  createComment
} from '../dom/index.js';

/**
 * This component is only for development purpose
 */
export class LogComponent extends Component {
  constructor(attrs) {
    super(attrs);
    this.msg = attrs.msg;
  }

  set msg(v) {
    console.log(v);
    this._msg = v;
  }

  get msg() {
    return this._msg;
  }

  [RENDER]() {
    return [createComment('log placeholder')];
  }
}
