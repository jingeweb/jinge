import type { Attrs } from 'src/core/attribute';
import type { AnyObj } from 'src/util';
import { watch, type ViewModel } from 'src/vm_v2';
import { Component } from '../core/component';

/**
 * ParameterComponent 是特殊的组件，通常用于编译器自动生成的代码，因此有特别的第二个参数 params 。
 * 通常情况下请勿直接使用该组件。
 */
export class ParameterComponent extends Component {
  constructor(attrs: ViewModel<Attrs<AnyObj>>, params: string[]) {
    super(attrs);
    params.forEach((p) => {
      (this as AnyObj)[p] = attrs[p];
      watch(attrs, p, () => {
        (this as AnyObj)[p] = attrs[p];
      });
    });
  }
}
