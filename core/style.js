import {
  Symbol,
  simpleUUID
} from '../util';
import {
  createElement,
  appendChild,
  getCSPropertyValue
} from '../dom';

export const CSTYLE_ADD = Symbol('add');
export const CSTYLE_DEL = Symbol('del');
export const CSTYLE_ATTACH = Symbol('attach');

function isHideCssExists() {
  const $e = createElement('span', {
    style: 'position:absolute;left:-10000px;',
    class: 'jg-hide'
  });
  appendChild(document.body, $e);
  return getCSPropertyValue(getComputedStyle($e), 'display') === 'none';
}

class ComponentStyleManager {
  constructor() {
    this.m = new Map();
    /**
     * State
     * 0: not attached
     * 1: attached
     */
    this.s = 0;
  }
  _c(sty) {
    if (this.s === 0) return;
    const $style = createElement('style', {
      type: 'text/css',
      id: sty.dom
    });
    appendChild(document.head, $style);
    if ($style.styleSheet) {
      $style.styleSheet.cssText = sty.css;
    } else {
      $style.textContent = sty.css;
    }
  }
  [CSTYLE_ADD](sty) {
    if (!sty) return;
    const styleMap = this.m;
    let info = styleMap.get(sty.id);
    if (info) {
      info.refs++;
      return;
    }
    info = {
      id: sty.id,
      css: sty.css,
      dom: `__${sty.id}__`,
      refs: 1
    };
    styleMap.set(sty.id, info);
    this._c(info);
  }
  [CSTYLE_ATTACH]() {
    if (this.s !== 0) return;
    this.s = 1;
    if (!isHideCssExists()) {
      this._c({
        dom: `__jgsty_${simpleUUID()}__`,
        css: '.jg-hide{display:none!important}.jg-hide.jg-hide-enter,.jg-hide.jg-hide-leave{display:block!important}'
      });
    }
    this.m.forEach(info => this._c(info));
  }
  [CSTYLE_DEL](sty) {
    if (!sty) return;
    const info = this.m.get(sty.id);
    if (!info) return;
    info.refs--;
    if (info.refs > 0) {
      return;
    }
    this.m.delete(info.id);
    if (this.s === 0) return;
    document.head.removeChild(
      document.getElementById(info.dom)
    );
  }
}

// singleton
export const manager = new ComponentStyleManager();
