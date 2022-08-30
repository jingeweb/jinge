import { $$ } from '../vm';
import { Attributes } from '../core/component';
import { ToggleClassComponent } from './class';

export interface HideComponentAttrs {
  test: boolean;
  transition: boolean;
}
export class HideComponent extends ToggleClassComponent {
  test: boolean;
  transition: boolean;

  constructor(attrs: Attributes<HideComponentAttrs>) {
    const fn = () => {
      attrs.class = attrs.test ? 'jg-hide' : null;
    };
    fn();
    attrs[$$].__watch('test', fn);
    super(attrs);
  }
}
