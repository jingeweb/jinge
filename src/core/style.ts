import { createElement } from '../util';

export type ComponentStyle = {
  id: string;
  css: string;
};

const CSS = '.jg-hide{display:none!important}.jg-hide.jg-hide-enter,.jg-hide.jg-hide-leave{display:block!important}';
let inited = false;
export function initStyle() {
  if (inited) return;
  inited = true;
  const $style = createElement('style', {
    type: 'text/css',
  }) as HTMLStyleElement & {
    styleSheet: {
      cssText: string;
    };
  };
  if ($style.styleSheet) $style.styleSheet.cssText = CSS;
  else $style.textContent = CSS;
  document.head.appendChild($style);
}
