import { watch } from 'src/vm_v2';
import { Component } from '../core/component';

export interface LogComponentAttrs {
  message: unknown;
}

const MESSAGE = Symbol('MESSAGE');
export class LogComponent extends Component {
  [MESSAGE]: unknown;

  constructor(attrs: LogComponentAttrs) {
    super(attrs);
    watch(
      attrs,
      'message',
      (v) => {
        this[MESSAGE] = v;
        this.__updateIfNeed();
      },
      { immediate: true },
    );
  }
  __render() {
    return [document.createComment(`${this[MESSAGE]}`)];
  }

  __update() {}
}
