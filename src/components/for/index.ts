import { $$, innerWatchPath, isViewModel } from '../../vm';
import type { JNode, PropsWithSlots } from '../../jsx';
import type { ComponentHost } from '../../core';
import { CONTEXT, DEFAULT_SLOT, ROOT_NODES, SLOTS, addUnmountFn } from '../../core';

import type { ForEach, KeyFn, KeyMap } from './common';
import { renderItems } from './render';
import { handleUpdate } from './update';

export interface ForProps<T> {
  loop: T[] | undefined | null;
  keyFn?: KeyFn<T>;
}
export type ForSlot<T> = (each: {
  data: T;
  index: number;
  isFirst: boolean;
  isLast: boolean;
}) => JNode;

export function For<T>(this: ComponentHost, props: PropsWithSlots<ForProps<T>, ForSlot<T>>) {
  const keyFn = props.keyFn; // keyFn 属性仅作为单向属性使用。
  let keys: KeyMap | undefined = keyFn ? new Map() : undefined;
  let renderLen = 0;

  if (isViewModel(props)) {
    const unwatchFn = innerWatchPath(
      props,
      props[$$],
      props.loop,
      (data, _, cp) => {
        // console.log('PATH:', cp);
        // console.log('-------');
        if (!cp || cp.length <= 1) {
          const oldLen = renderLen;
          renderLen = data?.length ?? 0;
          handleUpdate(this, oldLen, data, keys, keyFn, (newKeys) => {
            keys = newKeys;
          });
        } else {
          // 如果发生变更的路径 cp.length > 1，说明是数组里某个具体的元素发生变更，
          // 这种情况下 For 组件不需要响应和更新渲染。render 模板中有依赖到这个具体元素的地方，会在
          // ForEach 组件中自动被更新（因为会在这个具体元素上建立监听）
        }
      },
      ['loop'],
      true,
    );
    addUnmountFn(this, unwatchFn);
  }

  const render = () => {
    const roots = this[ROOT_NODES] as (ForEach<T> | Node)[];
    const itemRenderFn = this[SLOTS][DEFAULT_SLOT];
    const items = props.loop;
    if (!itemRenderFn || !items?.length) {
      roots.push(document.createComment('empty'));
      return roots as Node[];
    }
    renderLen = items.length;
    return renderItems(items, itemRenderFn, roots, keys, keyFn, this[CONTEXT]);
  };

  return render();
}
