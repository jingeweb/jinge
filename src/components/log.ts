import {
  Component, ComponentAttributes
} from '../core/component';

/**
 * This component is only for development purpose
 */
export class LogComponent extends Component {
  _msg: unknown;

  constructor(attrs: ComponentAttributes) {
    super(attrs);
    this.msg = attrs.msg;
  }

  set msg(v: unknown) {
    // eslint-disable-next-line no-console
    console.log(v);
    this._msg = v;
  }

  get msg(): unknown {
    return this._msg;
  }

  __render(): Node[] {
    return [document.createComment('log placeholder')];
  }
}
