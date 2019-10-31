
import {
  Component,
  RENDER,
  UPDATE,
  BEFORE_DESTROY,
  UPDATE_IF_NEED,
  HANDLE_BEFORE_DESTROY,
  GET_LAST_DOM,
  i18n as i18nService,
  I18N_GET_COMPONENT_RENDER,
  I18N_WATCH
} from '../core';
import {
  getParent,
  insertBefore,
  appendChild
} from '../util';
import {
  vmRelatedClear,
  VM_RELATED_LISTENERS
} from '../vm';

const RENDER_KEY = Symbol('render_key');
const RENDER_VMS = Symbol('render_vms');
const ON_LOCALE_CHANGE = Symbol('fn_on_locale_change');

export class I18nComponent extends Component {
  constructor(attrs, renderKey, renderVms) {
    super(attrs);
    this[RENDER_KEY] = renderKey;
    this[RENDER_VMS] = renderVms;
    this[I18N_WATCH](this[ON_LOCALE_CHANGE]);
  }

  [RENDER]() {
    const renderFn = i18nService[I18N_GET_COMPONENT_RENDER](this[RENDER_KEY]);
    return renderFn(this, ...this[RENDER_VMS]);
  }

  [ON_LOCALE_CHANGE]() {
    this[UPDATE_IF_NEED]();
  }

  [UPDATE]() {
    vmRelatedClear(this[VM_RELATED_LISTENERS]);

    let $el = this[GET_LAST_DOM]();
    const $parentEl = getParent($el);
    $el = $el.nextSibling;

    /*
     * 当前实现下，HANDLE_BEFORE_DESTROY 正好可以销毁子组件/子元素。
     */
    this[HANDLE_BEFORE_DESTROY](true);
    /*
     * 将新的元素替换到原来的旧的元素的位置。
     */
    const els = this[RENDER]();
    if ($el) {
      insertBefore($parentEl, els, $el);
    } else {
      appendChild($parentEl, els);
    }
  }

  [BEFORE_DESTROY]() {
    this[RENDER_VMS] = null; // unlink vms, maybe not necessary
  }
}
