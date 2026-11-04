import {
  CONTEXT,
  type ComponentHost,
  DEFAULT_SLOT_NAME,
  ROOT_NODES,
  addUnmountFn,
} from '../../core';
import { type FC, type JNode, type WithChildren } from '../../jsx';
import { destroyViewModelCore, innerWatchPath, isViewModel, vm } from '../../vm';
import { type ForEach, KEY_DATA, KEY_INDEX, type KeyFn, type KeyMap } from './common';
import { renderItems } from './render';
import { handleUpdate } from './update';

export { KEY_DATA, KEY_INDEX };

export interface ForProps<T> {
  loop: T[] | undefined | null;
  key?: keyof T | typeof KEY_INDEX | typeof KEY_DATA;
}

function getKeyFn<T>(k?: keyof T | typeof KEY_INDEX | typeof KEY_DATA): KeyFn<T> | undefined {
  if (k === undefined) {
    return undefined;
  } else if (k === KEY_DATA) {
    return (d) => d;
  } else if (k === KEY_INDEX) {
    return (_, i) => i;
  } else {
    // oxlint-disable-next-line typescript/no-implied-eval
    return new Function(
      '$jg$',
      `return $jg$${(k as string).startsWith('[') ? '' : '.'}${k as string}`,
    ) as KeyFn<T>;
  }
}
export type ForSlot<T> = (each: { data: T; index: number }) => JNode;

export function For<T>(props: ForProps<T> & WithChildren<ForSlot<T>>, host: ComponentHost) {
  const keyFn = getKeyFn(props.key);
  let keys: KeyMap<T> | undefined = keyFn ? new Map() : undefined;
  let renderLen = 0;

  // 直接传入 vm 数组时，编译器可能生成普通 props。为 loop 建立局部响应式
  // 容器，沿用属性路径监听和变更路径合并，避免漏掉同一轮中的数组结构变更。
  const watchedProps =
    isViewModel(props) || !isViewModel(props.loop) ? props : vm({ loop: props.loop });
  if (isViewModel(watchedProps)) {
    const unwatchFn = innerWatchPath(
      watchedProps,
      watchedProps.loop,
      (data, _, cp) => {
        // console.log('PATH:', cp);
        // console.log('-------');
        if (!cp || cp.length <= 2) {
          const oldLen = renderLen;
          renderLen = data?.length ?? 0;
          handleUpdate(
            host,
            props[DEFAULT_SLOT_NAME] as FC,
            oldLen,
            data,
            keys,
            keyFn,
            (newKeys) => {
              keys = newKeys;
            },
          );
        } else {
          // ['loop', index] 是元素替换，需要更新列表；更深的路径才是元素内部变更。
          // 这种情况下 For 组件不需要响应和更新渲染。render 模板中有依赖到这个具体元素的地方，会在
          // ForEach 组件中自动被更新（因为会在这个具体元素上建立监听）
        }
      },
      ['loop'],
      true,
    );
    addUnmountFn(host, unwatchFn);
    if (watchedProps !== props) {
      addUnmountFn(host, () => destroyViewModelCore(watchedProps));
    }
  }

  const roots = host[ROOT_NODES] as (ForEach<T> | Node)[];
  const itemRenderFn = props[DEFAULT_SLOT_NAME];
  const items = props.loop;
  if (!itemRenderFn || !items?.length) {
    roots.push(document.createComment('empty'));
    return roots as Node[];
  }
  renderLen = items.length;
  return renderItems(items, itemRenderFn, roots, keys, keyFn, host[CONTEXT]);
}
