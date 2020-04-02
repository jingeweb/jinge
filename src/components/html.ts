import {
  Component, ComponentAttributes, __
} from '../core/component';
import {
  createFragment
} from '../util';

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

export class BindHtmlComponent extends Component {
  _c: string;

  constructor(attrs: ComponentAttributes) {
    if (!('content' in attrs)) throw new Error('<bind-html/> require "content" attribute');
    super(attrs);
    this.content = attrs.content as string;
  }

  get content(): string {
    return this._c;
  }

  set content(v: string) {
    if (this._c === v) return;
    this._c = v;
    this.__updateIfNeed();
  }

  __render(): Node[] {
    return (this[__].rootNodes = renderHtml(this._c)) as Node[];
  }

  __update(): void {
    const roots = this[__].rootNodes;
    const oldFirstEl = roots[0] as Node;
    const $p = oldFirstEl.parentNode;
    const newEls = renderHtml(this._c);
    $p.insertBefore(newEls.length > 1 ? createFragment(newEls) : newEls[0], oldFirstEl);
    roots.forEach(oldEl => $p.removeChild(oldEl as Node));
    this[__].rootNodes = newEls;
  }
}
