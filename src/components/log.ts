import { ROOT_NODES } from 'src/core';
import { Component } from '../core/component';

export interface LogComponentAttrs {
  message: unknown;
}

const MESSAGE = Symbol('MESSAGE');
export class LogComponent extends Component {
  [MESSAGE]: unknown;

  constructor(attrs: LogComponentAttrs) {
    super();
    this.__bindAttr(attrs, 'message', MESSAGE);
  }

  __render() {
    return (this[ROOT_NODES] = [document.createComment(`${this[MESSAGE]}`)]);
  }

  __update() {
    (this[ROOT_NODES][0] as Node).textContent = `${this[MESSAGE]}`;
  }
}
