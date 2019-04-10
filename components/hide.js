import {
  wrapViewModel
} from '../viewmodel/proxy';
import {
  ToggleClassComponent
} from './class';
import {
  vmWatch,
  vmUnwatch
} from '../viewmodel/notify';
import {
  simpleUUID
} from '../util';

export const STR_JG_HIDE = 'jg-hide';

const STYLE = {
  id: `--jinge-hide-style-${simpleUUID()}--`,
  css: '.jg-hide{display:none!important}.jg-hide.jg-hide-enter,.jg-hide.jg-hide-leave{display:block!important}'
};

export class HideComponent extends ToggleClassComponent {
  static get style() {
    return STYLE;
  }
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
  beforeDestroy() {
    /* this.attrs is same as 'attrs' passed to constructor */
    vmUnwatch(this.attrs, 'test');
  }
}