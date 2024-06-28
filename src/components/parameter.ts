import type { AnyObj } from 'src/util';
import { Component } from '../core/component';

/**
 * Parameter 是特殊的组件，通常用于编译器自动生成的代码，因此有特别的第二个参数 params 。
 * 通常情况下请勿直接使用该组件。
 */
export class Parameter extends Component {
  constructor(attrs: AnyObj, params: string[]) {
    super(attrs);
    params.forEach((p) => {
      this.__bindAttr(attrs, p);
    });
  }
}
