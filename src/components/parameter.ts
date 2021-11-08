import { Component, ComponentAttributes } from '../core/component';
import { $$ } from '../vm/common';

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
