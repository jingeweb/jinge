import type { Component } from '../../core';
import {
  CONTEXT,
  DEFAULT_SLOT,
  destroyComponent,
  getLastDOM,
  handleRenderDone,
  ROOT_NODES,
  SLOTS,
} from '../../core';
import { createFragment } from '../../util';
import { renderItems } from './render';
import { KEY_FN, KEYS, LOOP_DATA, RENDER_LEN } from './common';
import { ELEMENT, type ForEach } from './each';
import type { For } from '.';

export function handleUpdate<T>(comp: For<T>, data: T[] | undefined | null) {
  const itemRenderFn = comp[SLOTS][DEFAULT_SLOT];
  if (!itemRenderFn) return;

  const oldLen = comp[RENDER_LEN];
  const oldV = comp[LOOP_DATA];
  comp[LOOP_DATA] = data;
  comp[RENDER_LEN] = data?.length ?? 0;

  const roots = comp[ROOT_NODES];
  const keys = comp[KEYS];

  if (!oldLen && !data?.length) {
    // 数据前后都没有发生变更。
    return;
  }

  // 从有数据变成没有数据，直接清空原来渲染的 ForEach 组件以及 keys，然后渲染 <!--empty-->
  if (!data?.length) {
    const lastNode = getLastDOM(comp);
    const nextSib = lastNode.nextSibling;
    const $parent = lastNode.parentNode as Node;

    roots.forEach((el) => {
      destroyComponent(el as Component);
    });
    roots.length = 0;
    keys && (keys.length = 0);
    const el = document.createComment('empty');
    if (nextSib) $parent.insertBefore(el, nextSib);
    else {
      $parent.appendChild(el);
    }
    roots.push(el);
    return;
  }

  // 从没有数据变成有数据。复用 renderItems 函数渲染 ForEach 列表。
  if (!oldV?.length) {
    const el = roots[0] as Node; // 第 0 个元素一定是 <!--empty-->
    roots.length = 0;
    const $parent = el.parentNode as Node;
    const doms = renderItems(data, itemRenderFn, roots, keys, comp[KEY_FN], comp[CONTEXT]);
    const dom = doms.length > 1 ? createFragment(doms) : doms[0];
    $parent.insertBefore(dom, el);
    $parent.removeChild(el);
    roots.forEach((el) => {
      handleRenderDone(el as Component);
    });
    return;
  }

  // 前后都有数据，如果没有 key 则直接原地更新
  const newLen = data.length;
  const updateLen = Math.min(oldLen, newLen);
  const dropLen = oldLen - updateLen;
  const appendLen = newLen - updateLen;
  for (let i = 0; i < updateLen; i++) {
    const el = roots[i] as ForEach<T>;
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
    keys?.splice(updateLen, dropLen);
    roots.splice(updateLen, dropLen);
  } else if (appendLen > 0) {
    const lastNode = getLastDOM(comp);
    const nextSib = lastNode.nextSibling;
    const $parent = lastNode.parentNode as Node;
    const doms = renderItems(
      data.slice(updateLen),
      itemRenderFn,
      roots,
      keys,
      comp[KEY_FN],
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
