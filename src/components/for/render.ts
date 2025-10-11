import { ComponentHost, type Context, renderSlotFunction } from '../../core';
import { type ForEach, KEY_DATA, type Key, type KeyFn } from './common';
import { isViewModel, vm } from '../../vm';

import { type FC } from '../../jsx';

function appendRenderEach<T>(
  vmMode: boolean,
  item: T,
  index: number,
  itemRenderFn: FC,
  roots: (ForEach<T> | Node)[],
  key: Key<T> | undefined,
  context?: Context,
) {
  // const el = newComponentWithDefaultSlot(context) as ForEach<T>;
  const el = new ComponentHost(context) as ForEach<T>;
  const each = vmMode
    ? vm({ data: item, index, key })
    : { data: item, index, key };
  el[KEY_DATA] = each;
  roots.push(el);
  return renderSlotFunction(el, itemRenderFn, each);
}

export function renderItems<T>(
  items: T[],
  itemRenderFn: FC,
  roots: (ForEach<T> | Node)[],
  keys: Map<Key<T>, number> | undefined,
  keyFn: KeyFn<T> | undefined,
  context?: Context,
) {
  const result: Node[] = [];
  const vmMode = isViewModel(items);
  items.forEach((item, index) => {
    const key = keyFn?.(item, index);
    if (keyFn) keys!.set(key!, index);
    const els = appendRenderEach(
      vmMode,
      item,
      index,
      itemRenderFn,
      roots,
      key,
      context,
    );
    result.push(...els);
  });
  return result;
}
