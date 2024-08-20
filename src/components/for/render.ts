import type { Context, Component, RenderFn } from '../../core';
import { CONTEXT, DEFAULT_SLOT, SLOTS } from '../../core';
import type { Key, KeyFn } from './common';
import { ForEach } from './each';

function newEach<T>(
  item: T,
  index: number,
  isLast: boolean,
  itemRenderFn: RenderFn,
  context?: Context,
) {
  const el = new ForEach<T>(item, index, isLast);
  el[SLOTS][DEFAULT_SLOT] = itemRenderFn;
  context && (el[CONTEXT] = context);
  return el;
}

function appendRenderEach<T>(
  item: T,
  index: number,
  isLast: boolean,
  itemRenderFn: RenderFn,
  roots: (Component | Node)[],
  context?: Context,
) {
  const el = newEach(item, index, isLast, itemRenderFn, context);
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
  items.forEach((item, index) => {
    if (keyFn) {
      (keys as Key[]).push(keyFn(item, index));
    }
    const els = appendRenderEach(
      item,
      index,
      index === items.length - 1,
      itemRenderFn,
      roots,
      context,
    );
    result.push(...els);
  });
  return result;
}
