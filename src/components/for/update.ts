import type { Component, RenderFn } from '../../core';
import {
  CONTEXT,
  DEFAULT_SLOT,
  destroyComponent,
  getLastDOM,
  handleRenderDone,
  isComponent,
  ROOT_NODES,
  SLOTS,
} from '../../core';
import { appendChildren, createFragment } from '../../util';
import { newEach, renderItems } from './render';
import type { Key, KeyFn } from './common';
import { KEY_FN, KEYS, LOOP_DATA, RENDER_LEN } from './common';
import { ELEMENT, type ForEach } from './each';
import type { For } from '.';

function loopMoveRootDOMToFrag(el: Component, frag: DocumentFragment) {
  el[ROOT_NODES].forEach((c) => {
    if (isComponent(c)) {
      loopMoveRootDOMToFrag(c, frag);
    } else {
      frag.appendChild(c);
    }
  });
}
export function updateWithKey<T>(
  comp: For<T>,
  itemRenderFn: RenderFn,
  data: T[],
  roots: ForEach<T>[],
  keys: Map<Key, number>,
  keyFn: KeyFn<T>,
) {
  const newLen = data.length;
  const newRoots: ForEach<T>[] = [];
  const $doms = createFragment();
  const newKeys: Map<Key, number> = new Map();
  const lastNode = getLastDOM(comp);
  const nextSib = lastNode.nextSibling;
  const $parent = lastNode.parentNode as Node;

  for (let i = 0; i < newLen; i++) {
    const item = data[i];
    const newKey = keyFn(item, i);
    newKeys.set(newKey, i);
    const oldIdx = keys.get(newKey);
    if (oldIdx === undefined) {
      // 没有匹配的旧的 key，创建新的组件。
      const el = newEach(true, item, i, itemRenderFn, comp[CONTEXT]);
      newRoots.push(el);
      appendChildren($doms, el.render());
    } else {
      // 有匹配的旧的 key，复用旧的元素。
      const el = roots[oldIdx];
      keys.delete(newKey);
      newRoots.push(el);
      if (el[ELEMENT] !== item) {
        el.data = item;
      }
      if (el.index !== i) {
        el.index = i;
      }
      loopMoveRootDOMToFrag(el, $doms);
    }
  }
  keys.forEach((index) => {
    // 剩下的是未被复用的元素，需要销毁
    destroyComponent(roots[index]);
  });

  if (nextSib) {
    $parent.insertBefore($doms, nextSib);
  } else {
    $parent.appendChild($doms);
  }

  comp[ROOT_NODES] = newRoots;
  comp[KEYS] = newKeys;
}

export function updateWithoutKey<T>(
  comp: For<T>,
  itemRenderFn: RenderFn,
  data: T[],
  oldLen: number,
  roots: ForEach<T>[],
) {
  const newLen = data.length;
  const updateLen = Math.min(oldLen, newLen);
  const dropLen = oldLen - updateLen;
  const appendLen = newLen - updateLen;
  for (let i = 0; i < updateLen; i++) {
    const el = roots[i];
    const pv = el[ELEMENT];
    const nv = data[i];
    if (nv === pv) {
      continue;
    }
    el.data = nv;
  }
  if (dropLen > 0) {
    for (let i = 0; i < dropLen; i++) {
      const el = roots[updateLen + i] as ForEach<T>;
      destroyComponent(el);
    }
    // keys?.splice(updateLen, dropLen);
    roots.splice(updateLen, dropLen);
  } else if (appendLen > 0) {
    const lastNode = getLastDOM(comp);
    const nextSib = lastNode.nextSibling;
    const $parent = lastNode.parentNode as Node;
    const doms = renderItems(
      data.slice(updateLen),
      itemRenderFn,
      roots,
      undefined,
      undefined,
      comp[CONTEXT],
    );
    const dom = doms.length > 1 ? createFragment(doms) : doms[0];
    if (nextSib) $parent.insertBefore(dom, nextSib);
    else $parent.appendChild(dom);
    for (let i = 0; i < appendLen; i++) {
      handleRenderDone(roots[updateLen + i] as ForEach<T>);
    }
  }
}
export function handleUpdate<T>(comp: For<T>, data: T[] | undefined | null) {
  const itemRenderFn = comp[SLOTS][DEFAULT_SLOT];
  if (!itemRenderFn) return;

  const oldLen = comp[RENDER_LEN];
  if (!oldLen && !data?.length) {
    // 数据前后都是空。比如从 null 变成 undefined 或空数组。
    return;
  }
  const oldV = comp[LOOP_DATA];
  comp[LOOP_DATA] = data;
  comp[RENDER_LEN] = data?.length ?? 0;

  const roots = comp[ROOT_NODES];
  const keys = comp[KEYS];

  // 从有数据变成没有数据，直接清空原来渲染的 ForEach 组件以及 keys，然后渲染 <!--empty-->
  if (!data?.length) {
    const lastNode = getLastDOM(comp);
    const nextSib = lastNode.nextSibling;
    const $parent = lastNode.parentNode as Node;

    roots.forEach((el) => {
      destroyComponent(el as Component);
    });
    roots.length = 0;
    keys?.clear();
    const el = document.createComment('empty');
    if (nextSib) $parent.insertBefore(el, nextSib);
    else {
      $parent.appendChild(el);
    }
    roots.push(el);
    return;
  }

  const keyFn = comp[KEY_FN];
  // 从没有数据变成有数据。复用 renderItems 函数渲染 ForEach 列表。
  if (!oldV?.length) {
    const el = roots[0] as Node; // 第 0 个元素一定是 <!--empty-->
    roots.length = 0;
    const $parent = el.parentNode as Node;
    const doms = renderItems(data, itemRenderFn, roots, keys, keyFn, comp[CONTEXT]);
    const dom = doms.length > 1 ? createFragment(doms) : doms[0];
    $parent.insertBefore(dom, el);
    $parent.removeChild(el);
    roots.forEach((el) => {
      handleRenderDone(el as Component);
    });
    return;
  }

  // 前后都有数据
  if (keyFn) {
    // 如果有 key 则复用 key 相同的元素
    updateWithKey(comp, itemRenderFn, data, roots as ForEach<T>[], keys as Map<Key, number>, keyFn);
  } else {
    // 如果没有 key 则直接原地更新
    updateWithoutKey(comp, itemRenderFn, data, oldLen, roots as ForEach<T>[]);
  }
}
