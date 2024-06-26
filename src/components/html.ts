import { ROOT_NODES, __ } from 'src/core';
import { Component } from '../core/component';
import { createFragment } from '../util';

function renderHtml(content: string): Node[] {
  const $d = document.createElement('div');
  $d.innerHTML = content || '';
  let cn = $d.childNodes as unknown as Node[];
  if (cn.length === 0) {
    cn = [document.createComment('empty')];
  } else {
    cn = [].slice.call(cn); // convert NodeList to Array.
  }
  return cn;
}

export interface BindHtmlComponentAttrs {
  content: string;
}


export class BindHtmlComponent extends Component {
  content: string;

  constructor(attrs: BindHtmlComponentAttrs) {
    super(attrs);
    this.content = attrs.content;
  }

  get content() {
    return this.#content;
  }

  set content(v) {
    if (this.#content === v) return;
    this.#content = v;
    this.__updateIfNeed();
  }

  __render() {
    return (this[__][ROOT_NODES] = renderHtml(this.content));
  }

  __update() {
    const roots = this[__][ROOT_NODES];
    const oldFirstEl = roots[0] as Node;
    const $p = oldFirstEl.parentNode;
    const newEls = renderHtml(this.content);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    $p!.insertBefore(newEls.length > 1 ? createFragment(newEls) : newEls[0], oldFirstEl);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    roots.forEach((oldEl) => $p!.removeChild(oldEl as Node));
    this[__][ROOT_NODES] = newEls;
  }
}
