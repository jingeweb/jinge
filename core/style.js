import {
  Symbol,
  simpleUUID,
  assert_fail,
  clearImmediate,
  setImmediate
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
    this.a = [];
    this.s = null;
    this.i = null;
  }
  _c() {
    const code = this.a.map(info => info.css).join('\n');
    const $style = this.s;
    if ($style.styleSheet) {
      $style.styleSheet.cssText = code;
    } else {
      $style.textContent = code;
    }
  }
  _u(imm = true) {
    if (!this.s) return;
    if (this.i) {
      clearImmediate(this.i);
      this.i = null;
    }
    if (imm) {
      this.i = setImmediate(() => {
        this.i = null;
        this._c();
      });
    } else {
      this._c();
    }
  }
  [CSTYLE_ATTACH]() {
    if (this.s) return;
    const $style = createElement('style', {
      type: 'text/css',
      id: `__jinge_component_style_${simpleUUID()}__`
    });
    appendChild($style, '');
    appendChild(document.head || document.getElementsByTagName('head')[0], $style);
    this.s = $style;
    if (this.a.length > 0) {
      this._u(false);
    }
  }
  [CSTYLE_ADD](sty) {
    if (!sty) return;
    const styleMap = this.m;
    const sheetArr = this.a;
    let info = styleMap.get(sty.id);
    if (info) {
      info.refs++;
      return;
    }
    info = {
      id: sty.id,
      css: sty.css,
      index: sheetArr.length,
      refs: 1
    };
    sheetArr.push(info);
    styleMap.set(sty.id, info);
    this._u();
  }
  [CSTYLE_DEL](sty) {
    if (!sty) return;
    const sheet = this.s;
    if (!sheet) return;
    const info = this.m.get(sty.id);
    if (!info) return;
    info.refs--;
    if (info.refs > 0) {
      return;
    }
    const sheetArr = this.a;
    if (info !== sheetArr[info.index]) {
      assert_fail();
    }
    for(let i = info.index + 1; i < sheetArr.length; i++) {
      sheetArr[i].index--;
    }
    sheetArr.splice(info.index, 1);
    this.m.delete(info.id);
    this._u();
  }
}

// singleton
export const manager = new ComponentStyleManager();
