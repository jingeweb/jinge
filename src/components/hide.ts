import { $$ } from '../vm/common';
import { vm } from '../vm/index';
import { Attributes } from '../core/component';
import { ToggleClassComponent, ToggleClassComponentAttrs } from './class';

export interface HideComponentAttrs {
  hide: boolean;
}
export class HideComponent extends ToggleClassComponent {
  constructor(attrs: Attributes<HideComponentAttrs>) {
    attrs.class = vm({
      'jg-hide': attrs.test as boolean,
    });
    attrs[$$].__watch('test', () => {
      (attrs.class as { 'jg-hide': boolean })['jg-hide'] = attrs.hide;
    });
    super(attrs as unknown as Attributes<ToggleClassComponentAttrs>);
  }
}
