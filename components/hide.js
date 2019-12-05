import {
  wrapViewModel,
  vmWatch
} from '../vm';
import {
  ToggleClassComponent
} from './class';

export const STR_JG_HIDE = 'jg-hide';

export class HideComponent extends ToggleClassComponent {
  constructor(attrs) {
    attrs.class = wrapViewModel({
      [STR_JG_HIDE]: !!attrs.test
    });
    vmWatch(attrs, 'test', () => {
      if (attrs.class[STR_JG_HIDE] !== attrs.test) {
        attrs.class[STR_JG_HIDE] = attrs.test;
      }
    });
    // eslint-disable-next-line constructor-super
    return super(attrs);
  }
}
