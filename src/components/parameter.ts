import { Component, ComponentAttributes } from '../core/component';
import { $$ } from '../vm/core';

/**
 * ParameterComponent 是特殊的组件，通常用于编译器自动生成的代码，因此有特别的第二个参数 params 。
 * 通常情况下请勿直接使用该组件。
 */
export class ParameterComponent extends Component {
  constructor(attrs: ComponentAttributes, params: string[]) {
    super(attrs);
    params.forEach((p) => {
      (this as Record<string, unknown>)[p] = attrs[p];
      attrs[$$].__watch(p, () => {
        (this as Record<string, unknown>)[p] = attrs[p];
      });
    });
  }
}
