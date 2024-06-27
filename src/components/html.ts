import { ROOT_NODES, __ } from 'src/core';
import { Component } from '../core/component';
import { createFragment } from '../util';

function renderHtml(content?: string): Node[] {
  const $d = document.createElement('div');
  $d.innerHTML = content ?? '';
  let cn = $d.childNodes as unknown as Node[];
  if (cn.length === 0) {
    cn = [document.createComment('empty')];
  } else {
    cn = [].slice.call(cn); // convert NodeList to Array.
  }
  return cn;
}

export interface BindHtmlAttrs {
  content: string;
}

export const CONTENT = Symbol();
export class BindHtml extends Component {
  [CONTENT]?: string;

  constructor(attrs: BindHtmlAttrs) {
    super(attrs);
    this.__bindAttr(attrs, 'content', CONTENT);
  }

  __render() {
    return (this[__][ROOT_NODES] = renderHtml(this[CONTENT]));
  }

  __update() {
    const roots = this[__][ROOT_NODES];
    const oldFirstEl = roots[0] as Node;
    const $p = oldFirstEl.parentNode as HTMLElement;
    const newEls = renderHtml(this[CONTENT]);
    $p.insertBefore(newEls.length > 1 ? createFragment(newEls) : newEls[0], oldFirstEl);
    roots.forEach((oldEl) => $p.removeChild(oldEl as Node));
    this[__][ROOT_NODES] = newEls;
  }
}
