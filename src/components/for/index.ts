import type { JNode } from '../../jsx';
import { CONTEXT, DEFAULT_SLOT, ROOT_NODES, SLOTS } from '../../core';
import { Component } from '../../core/component';

import type { ForProps, Key, KeyFn } from './common';
import { KEY_FN, KEYS, LOOP_DATA } from './common';
import { renderItems } from './render';

export type ForSlot<T> = (item: T, index: number) => JNode;
export class For<T> extends Component<ForProps<T>, ForSlot<T>> {
  [LOOP_DATA]?: T[];
  [KEYS]?: Key[];
  [KEY_FN]?: KeyFn<T>;

  constructor(attrs: ForProps<T>) {
    super();

    this.bindAttr(attrs, 'loop', LOOP_DATA);
  }

  render() {
    const roots = this[ROOT_NODES];
    const itemRenderFn = this[SLOTS][DEFAULT_SLOT];
    const items = this[LOOP_DATA];
    if (!itemRenderFn || !items?.length) {
      roots.push(document.createComment('empty'));
      return roots as Node[];
    }
    return renderItems(items, itemRenderFn, roots, this[KEYS], this[KEY_FN], this[CONTEXT]);
  }
}
