import type { ComponentHost, RenderFn } from '../../core';
import {
  CONTEXT,
  DEFAULT_SLOT,
  ROOT_NODES,
  SLOTS,
  destroyComponent,
  getFirstDOM,
  getLastDOM,
  handleRenderDone,
  isComponent,
  newComponentWithDefaultSlot,
  renderSlotFunction,
} from '../../core';
import { createFragment } from '../../util';
import { vm } from '../../vm';
import { renderItems } from './render';
import { EACH, type EachVm, type ForEach, type Key, type KeyFn, type KeyMap } from './common';

function loopMoveRootDOMToFrag(el: ComponentHost, frag: DocumentFragment) {
  el[ROOT_NODES].forEach((c) => {
    if (isComponent(c)) {
      loopMoveRootDOMToFrag(c, frag);
    } else {
      frag.appendChild(c);
    }
  });
}
export function updateWithKey<T>(
  comp: ComponentHost,
  itemRenderFn: RenderFn,
  data: T[],
  roots: ForEach<T>[],
  keys: Map<Key, number>,
  keyFn: KeyFn<T>,
  onKeysUpdated: (newKeys: KeyMap) => void,
) {
  const newLen = data.length;
  const newRoots: ForEach<T>[] = [];
  const newKeys = new Map<Key, number>();

  let pi = 0;
  let pe: Node | null = getFirstDOM(comp);
  const $parent = pe?.parentNode as Node;
  for (let i = 0; i < newLen; i++) {
    const item = data[i];
    const newKey = keyFn(item, i);
    newKeys.set(newKey, i);
    const oldIdx = keys.get(newKey);
    if (oldIdx === undefined) {
      // 没有匹配的旧的 key，创建新的组件。
      const el = newComponentWithDefaultSlot(comp[CONTEXT]) as ForEach<T>;
      const each: EachVm<T> = vm({ data: item, index: i, key: newKey });
      el[EACH] = each;
      newRoots.push(el);
      const doms = renderSlotFunction(el, itemRenderFn, each);
      const d = doms.length > 1 ? createFragment(doms) : doms[0];
      if (pe) $parent.insertBefore(d, pe);
      else $parent.appendChild(d);
      // console.log('append', pe, newKey);
    } else {
      // 有匹配的旧的 key，复用旧的元素。
      const el = roots[oldIdx];
      keys.delete(newKey);
      newRoots.push(el);
      const each = el[EACH];
      if (each.data !== item) {
        each.data = item;
      }
      if (each.index !== i) {
        each.index = i;
      }
      if (oldIdx < pi) {
        const frag = createFragment();
        loopMoveRootDOMToFrag(el, frag);
        if (pe) $parent.insertBefore(frag, pe);
        else $parent.appendChild(frag);
        // console.log('move', newKey, pe);
      } else {
        pi = oldIdx;
        pe = getLastDOM(el).nextSibling;
      }
    }
  }
  keys.forEach((index) => {
    // 剩下的是未被复用的元素，需要销毁
    destroyComponent(roots[index]);
  });

  comp[ROOT_NODES] = newRoots;
  onKeysUpdated(newKeys);
}

export function updateWithoutKey<T>(
  comp: ComponentHost,
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
    const each = roots[i][EACH];
    const pv = each.data;
    const nv = data[i];
    if (nv === pv) {
      continue;
    }
    each.data = nv;
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
export function handleUpdate<T>(
  comp: ComponentHost,
  oldLen: number,
  data: T[] | undefined | null,
  keys: KeyMap | undefined,
  keyFn: KeyFn<T> | undefined,
  onKeysUpdated: (newKeys: KeyMap) => void,
) {
  const itemRenderFn = comp[SLOTS][DEFAULT_SLOT];
  if (!itemRenderFn) return;

  const newLen = data?.length ?? 0;
  if (oldLen === 0 && newLen === 0) {
    // 数据前后都是空。比如从 null 变成 undefined 或空数组。
    return;
  }

  const roots = comp[ROOT_NODES];

  // 从有数据变成没有数据，直接清空原来渲染的 ForEach 组件以及 keys，然后渲染 <!--empty-->
  if (newLen === 0) {
    const lastNode = getLastDOM(comp);
    const nextSib = lastNode.nextSibling;
    const $parent = lastNode.parentNode as Node;

    roots.forEach((el) => {
      destroyComponent(el as ComponentHost);
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

  // 从没有数据变成有数据。复用 renderItems 函数渲染 ForEach 列表。
  if (oldLen === 0) {
    const el = roots[0] as Node; // 第 0 个元素一定是 <!--empty-->
    roots.length = 0;
    const $parent = el.parentNode as Node;
    const doms = renderItems(
      data!,
      itemRenderFn,
      roots as ForEach<T>[],
      keys,
      keyFn,
      comp[CONTEXT],
    );
    const dom = doms.length > 1 ? createFragment(doms) : doms[0];
    $parent.insertBefore(dom, el);
    $parent.removeChild(el);
    roots.forEach((el) => {
      handleRenderDone(el as ComponentHost);
    });
    return;
  }

  // 前后都有数据
  if (keyFn) {
    // 如果有 key 则复用 key 相同的元素
    updateWithKey(
      comp,
      itemRenderFn,
      data!,
      roots as ForEach<T>[],
      keys as Map<Key, number>,
      keyFn,
      onKeysUpdated,
    );
  } else {
    // 如果没有 key 则直接原地更新
    updateWithoutKey(comp, itemRenderFn, data!, oldLen, roots as ForEach<T>[]);
  }
}
