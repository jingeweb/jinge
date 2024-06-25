import type { ComponentAttributes } from '../core/component';
import { Component } from '../core/component';

export interface LogComponentAttrs {
  msg: unknown;
}
export class LogComponent extends Component {
  _msg: unknown;

  constructor(attrs: ComponentAttributes & LogComponentAttrs) {
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

  __render() {
    return [document.createComment(this._msg.toString())];
  }
}
