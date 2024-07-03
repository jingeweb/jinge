import { ROOT_NODES } from 'src/core';
import { Component, isComponent } from '../core/component';

function setDisplay(el: Node, show?: boolean) {
  if (el.nodeType === Node.ELEMENT_NODE) {
    (el as HTMLElement).style.display = show ? '' : 'none';
  }
}

export interface ShowAttrs {
  expect?: boolean;
}

const EXPECT = Symbol('EXPECT');
/**
 * 控制元素显示隐藏（display: none）的组件。
 *
 * 如果切换显示隐藏需要动画，请使用 Transtion 组件。
 *
 * 如果切换时需要销毁内容，请使用 If 组件。
 */
export class Show extends Component {
  [EXPECT]?: boolean;

  constructor(attrs: ShowAttrs) {
    super();
    this.__bindAttr(attrs, 'expect', EXPECT);
  }

  __render() {
    const els = super.__render();
    this.__update();
    return els;
  }

  __update() {
    for (const node of this[ROOT_NODES]) {
      setDisplay(isComponent(node) ? node.__firstDOM : node, this[EXPECT]);
    }
  }
}
