import { $$, innerWatchPath, isViewModel } from '../../vm';
import type { JNode } from '../../jsx';
import { CONTEXT, DEFAULT_SLOT, ROOT_NODES, SLOTS } from '../../core';
import { Component } from '../../core/component';

import type { ForProps, Key, KeyFn } from './common';
import { KEY_FN, KEYS, LOOP_DATA, RENDER_LEN } from './common';
import { renderItems } from './render';
import { handleUpdate } from './update';

export type ForSlot<T> = (item: {
  data: T;
  index: number;
  isFirst: boolean;
  isLast: boolean;
}) => JNode;

export class For<T> extends Component<ForProps<T>, ForSlot<T>> {
  [LOOP_DATA]?: T[] | null;
  [KEYS]?: Key[];
  [KEY_FN]?: KeyFn<T>;
  [RENDER_LEN] = 0;

  constructor(attrs: ForProps<T>) {
    super();

    // this.bindAttr(attrs, 'loop', LOOP_DATA);
    this[LOOP_DATA] = attrs.loop;
    if (isViewModel(attrs)) {
      const unwatchFn = innerWatchPath(
        attrs,
        attrs[$$],
        attrs.loop,
        (data, _, cp) => {
          // console.log('PATH:', cp);
          // console.log('-------');
          if (!cp || cp.length <= 1) {
            handleUpdate(this, data);
          } else {
            // 如果发生变更的路径 cp.length > 1，说明是数组里某个具体的元素发生变更，
            // 这种情况下 For 组件不需要响应和更新渲染。render 模板中有依赖到这个具体元素的地方，会在
            // ForEach 组件中自动被更新（因为会在这个具体元素上建立监听）
          }
        },
        ['loop'],
        true,
      );
      this.addUnmountFn(unwatchFn);
    }
  }

  render() {
    const roots = this[ROOT_NODES];
    const itemRenderFn = this[SLOTS][DEFAULT_SLOT];
    const items = this[LOOP_DATA];
    if (!itemRenderFn || !items?.length) {
      roots.push(document.createComment('empty'));
      return roots as Node[];
    }
    this[RENDER_LEN] = items.length;
    return renderItems(items, itemRenderFn, roots, this[KEYS], this[KEY_FN], this[CONTEXT]);
  }
}
