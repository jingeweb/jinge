import {
  uid, createElement
} from '../util';

function isHideCssExists(): boolean {
  const $e = createElement('span', {
    style: 'position:absolute;left:-10000px;',
    class: 'jg-hide'
  });
  document.body.appendChild($e);
  const exist = getComputedStyle($e).getPropertyValue('display') === 'none';
  document.body.removeChild($e);
  return exist;
}

export type ComponentStyle = {
  id: string;
  css: string;
}
type StyleInfo = {
  id?: string;
  css: string;
  dom: string;
  refs?: number;
}

class ComponentStyleManager {
  private m: Map<string, StyleInfo>;
  /**
   * State  
   * 0: not attached  
   * 1: attached
   */
  private s: number;

  constructor() {
    this.m = new Map();
    this.s = 0;
  }

  private create(sty: StyleInfo): void {
    if (this.s === 0) return;
    const $style = createElement('style', {
      type: 'text/css',
      id: sty.dom
    }) as HTMLStyleElement & {
      styleSheet: {
        cssText: string;
      };
    };
    document.head.appendChild($style);
    if ($style.styleSheet) {
      $style.styleSheet.cssText = sty.css;
    } else {
      $style.textContent = sty.css;
    }
  }

  add(sty: ComponentStyle): void {
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
    this.create(info);
  }

  attch(): void {
    if (this.s !== 0) {
      return;
    }
    this.s = 1;
    if (!isHideCssExists()) {
      this.create({
        dom: `__jgsty_${uid()}__`,
        css: '.jg-hide{display:none!important}.jg-hide.jg-hide-enter,.jg-hide.jg-hide-leave{display:block!important}'
      });
    }
    this.m.forEach(info => {
      this.create(info);
    });
  }

  remove(sty: ComponentStyle): void {
    if (!sty) return;
    const info = this.m.get(sty.id);
    if (!info) return;
    info.refs--;
    if (info.refs > 0) {
      return;
    }
    this.m.delete(info.id);
    if (this.s === 0) {
      return;
    }
    document.head.removeChild(
      document.getElementById(info.dom)
    );
  }
}

// singleton
export const manager = new ComponentStyleManager();
