import {
  Component
} from '../core';
import {
  VM_ON,
  VM_ATTRS
} from '../vm';

export class ParameterComponent extends Component {
  constructor(attrs, params) {
    super(attrs);
    params.forEach(p => {
      this[p] = attrs[p];
      attrs[VM_ATTRS][VM_ON](p, () => {
        this[p] = attrs[p];
      });
    });
  }
}
