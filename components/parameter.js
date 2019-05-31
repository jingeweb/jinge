import {
  Component
} from '../core/component.js';
import {
  VM_ON
} from '../viewmodel/notify.js';

export class ParameterComponent extends Component {
  constructor(attrs, params) {
    super(attrs);
    params.forEach(p => {
      this[p] = attrs[p];
      attrs[VM_ON](p, () => this[p] = attrs[p]);
    });
  }
}