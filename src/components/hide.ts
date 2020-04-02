import {
  $$
} from '../vm/common';
import {
  vm
} from '../vm/index';
import {
  ToggleClassComponent
} from './class';
import {
  ComponentAttributes
} from '../core/component';

export class HideComponent extends ToggleClassComponent {
  constructor(attrs: ComponentAttributes & {class: {'jg-hide': boolean}}) {
    attrs.class = vm({
      'jg-hide': attrs.test as boolean
    });
    attrs[$$].__watch('test', () => {
      if (attrs.class['jg-hide'] !== attrs.test) {
        attrs.class['jg-hide'] = attrs.test as boolean;
      }
    });
    super(attrs);
  }
}
