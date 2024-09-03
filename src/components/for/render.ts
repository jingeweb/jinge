import { isViewModel, vm } from '../../vm';
import type { Context, RenderFn } from '../../core';
import { newComponentWithDefaultSlot, renderSlotFunction } from '../../core';
import { EACH, type ForEach, type Key, type KeyFn } from './common';

function appendRenderEach<T>(
  vmMode: boolean,
  item: T,
  index: number,
  itemRenderFn: RenderFn,
  roots: (ForEach<T> | Node)[],
  key: Key | undefined,
  context?: Context,
) {
  const el = newComponentWithDefaultSlot(context) as ForEach<T>;
  const each = vmMode ? vm({ data: item, index, key }) : { data: item, index, key };
  el[EACH] = each;
  roots.push(el);
  return renderSlotFunction(el, itemRenderFn, each);
}

export function renderItems<T>(
  items: T[],
  itemRenderFn: RenderFn,
  roots: (ForEach<T> | Node)[],
  keys: Map<Key, number> | undefined,
  keyFn: KeyFn<T> | undefined,
  context?: Context,
) {
  const result: Node[] = [];
  const vmMode = isViewModel(items);
  items.forEach((item, index) => {
    const key = keyFn?.(item, index);
    keyFn && keys!.set(key!, index);
    const els = appendRenderEach(vmMode, item, index, itemRenderFn, roots, key, context);
    result.push(...els);
  });
  return result;
}
