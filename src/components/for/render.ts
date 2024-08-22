import { isViewModel } from '../../vm';
import type { Context, Component, RenderFn } from '../../core';
import { CONTEXT, DEFAULT_SLOT, SLOTS } from '../../core';
import type { Key, KeyFn } from './common';
import { ForEach } from './each';

function newEach<T>(
  vmMode: boolean,
  item: T,
  index: number,
  itemRenderFn: RenderFn,
  context?: Context,
) {
  const el = new ForEach<T>(vmMode, item, index);
  el[SLOTS][DEFAULT_SLOT] = itemRenderFn;
  context && (el[CONTEXT] = context);
  return el;
}

function appendRenderEach<T>(
  vmMode: boolean,
  item: T,
  index: number,
  itemRenderFn: RenderFn,
  roots: (Component | Node)[],
  context?: Context,
) {
  const el = newEach(vmMode, item, index, itemRenderFn, context);
  roots.push(el);
  return el.render();
}

export function renderItems<T>(
  items: T[],
  itemRenderFn: RenderFn,
  roots: (Component | Node)[],
  keys: Key[] | undefined,
  keyFn: KeyFn<T> | undefined,
  context?: Context,
) {
  const result: Node[] = [];
  const vmMode = isViewModel(items);
  items.forEach((item, index) => {
    if (keyFn) {
      (keys as Key[]).push(keyFn(item, index));
    }
    const els = appendRenderEach(vmMode, item, index, itemRenderFn, roots, context);
    result.push(...els);
  });
  return result;
}
