import {
  Symbol
} from '../util';
import {
  createElement,
  appendChild
} from '../dom';

export const CSTYLE_ADD = Symbol('add');
export const CSTYLE_DEL = Symbol('del');
export const CSTYLE_ATTACH = Symbol('attach');

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
