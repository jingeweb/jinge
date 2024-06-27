import { isViewModel, notifyVmChange } from 'src/vm_v2';
import { CONTEXT, ROOT_NODES, SLOTS, __, type RenderFn } from 'src/core';
import { newEmptyAttrs } from 'src/core/attribute';
import { Component, isComponent } from '../core/component';

import { isString, isNumber, isArray, createFragment, insertAfter } from '../util';

type ForKeyNameFn = (v: unknown) => string;
type ForKeyName = string | ForKeyNameFn;

export const ELEMENT = Symbol('ELEMENT');
export class ForEach extends Component {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  [ELEMENT]: unknown;

  constructor(attrs: object, item: unknown, index: number, isLast: boolean) {
    super(attrs);

    // 此处不能直接使用 this.each = item，因为如果是 Public propery 的更新，会自动把 item 转成 ViewModel
    // 但 For 组件支持渲染非 ViewModel 数据，当数据量很大时，必须阻止自动转成 ViewModel 数据。
    this[ELEMENT] = item;

    this.index = index;
    this.isFirst = index === 0;
    this.isLast = isLast;
  }

  get each() {
    return this[ELEMENT];
  }
}

function createEl(
  item: unknown,
  i: number,
  isLast: boolean,
  itemRenderFn: RenderFn,
  context?: Record<string | symbol, unknown>,
): ForEach {
  return new ForEach(newEmptyAttrs(itemRenderFn, context), item, i, isLast);
}

function appendRenderEach(
  item: unknown,
  i: number,
  isLast: boolean,
  itemRenderFn: RenderFn,
  roots: (Component | Node)[],
  context?: Record<string | symbol, unknown>,
) {
  const el = createEl(item, i, isLast, itemRenderFn, context);
  roots.push(el);
  return el.__render();
}

// function _assertVm(item, i) {
//   if (isObject(item) && !isInnerObj(item) && !(VM_ATTRS in item)) {
//     throw new Error(`loop item [${i}] of <for> component must be ViewModel.`);
//   }
// }

function _prepareKey(
  item: unknown,
  i: number,
  keyMap: Map<unknown, number>,
  keyName: ForKeyName,
): unknown {
  const key = keyName === 'each' ? item : (keyName as ForKeyNameFn)(item);
  if (keyMap.has(key)) {
    // eslint-disable-next-line no-console
    console.error(
      `loop items [${i}] and [${keyMap.get(
        key,
      )}] of <for> component both have key '${key}', dulplicated key may cause update error.`,
    );
  }
  keyMap.set(key, i);
  return key;
}

function renderItems(
  items: unknown[],
  itemRenderFn: RenderFn,
  roots: (Component | Node)[],
  keys: unknown[] | undefined,
  keyName: ForKeyName,
  context?: Record<string | symbol, unknown>,
) {
  const result: Node[] = [];
  const tmpKeyMap = new Map();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // _assertVm(item, i);
    if (keyName !== 'index') {
      (keys as unknown[]).push(_prepareKey(item, i, tmpKeyMap, keyName));
    }
    const els = appendRenderEach(item, i, i === items.length - 1, itemRenderFn, roots, context);
    result.push(...els);
  }
  return result;
}

function loopAppend($parent: Node, el: Component) {
  el[__][ROOT_NODES].forEach((node) => {
    if (isComponent(node)) {
      loopAppend($parent, node as Component);
    } else {
      $parent.appendChild(node as Node);
    }
  });
}

function updateEl(el: ForEach, i: number, items: unknown[]) {
  if (el.isFirst !== (i === 0)) {
    el.isFirst = i === 0;
  }
  if (el.isLast !== (i === items.length - 1)) {
    el.isLast = i === items.length - 1;
  }
  if (el.index !== i) {
    el.index = i;
  }
  const newV = items[i];
  if (el[ELEMENT] !== newV) {
    el[ELEMENT] = newV;
    notifyVmChange(el, ['each']);
  }
}

function _parseIndexPath(p: string | number): string | number {
  return isString(p) && p !== 'length' && /^\d+$/.test(p as string) ? Number(p) : p;
}

export interface ForAttrs {
  loop: unknown[];
  key?: string;
}
export const LOOP_DATA = Symbol('LOOP_DATA');
export const KEY_NAME = Symbol('KEY_NAME');
export const LEN = Symbol('LEN');
export const KEYS = Symbol('KEYS');
export const WATING_UPDATE = Symbol('WATING_UPDATE');
export class For extends Component {
  [LOOP_DATA]: unknown[];
  [KEY_NAME]: ForKeyName;
  [LEN]: number;
  [KEYS]?: unknown[];
  [WATING_UPDATE]?: boolean;

  constructor(attrs: ForAttrs) {
    super(attrs);

    this.__bindAttr(attrs, 'loop', LOOP_DATA);

    const kn = attrs.key ?? 'index'; // TODO: support handle attrs.key change
    this[KEY_NAME] = kn;
    this[LEN] = 0;

    if (kn !== 'index' && kn !== 'each') {
      /* eslint no-new-func:"off" */
      this[KEY_NAME] = new Function('each', `return ${kn}`) as ForKeyNameFn;
      // console.log('loop.*.' + kn.slice(5));
      const propCount = kn.split('.').length + 1;
      // console.log(propCount);

      this[$$].__watch('loop.*.' + kn.slice(5), (propPath: (string | number)[]) => {
        if (propPath.length !== propCount || this._waitingUpdate) {
          // ignore if it's parent path
          // or is alreay waiting for update
          // console.log('skip2', propPath);
          return;
        }
        // console.log(propPath);
        const items = this.loop;
        if (!isArray(items) || items.length === 0) return;
        const p = _parseIndexPath(propPath[1]);
        if (!isNumber(p) || (p as number) >= items.length) {
          return;
        }
        // console.log('update item key:', p);
        this._keys[p as number] = (this._keyName as ForKeyNameFn)(items[p as number]);
      });
    }
    this[$$].__watch('loop.*', (propPath: (string | number)[]) => {
      if (
        this[__].state !== ComponentStates.RENDERED ||
        propPath.length !== 2 ||
        this._waitingUpdate
      ) {
        // if propPath.length === 1 means loop variable changed, loop setter will handle it.
        // ignore if is alreay waiting for update
        // console.log('skip', propPath);
        return;
      }
      // console.log(propPath);
      const p = _parseIndexPath(propPath[1]);
      if (p === 'length') {
        this._waitingUpdate = true;
        this.__updateNextTick();
      } else if (isNumber(p)) {
        this._updateItem(p as number);
      }
    });
  }

  __render() {
    const roots = this[__][ROOT_NODES];
    const itemRenderFn = this[__][SLOTS]?.default;
    if (!itemRenderFn) {
      roots.push(document.createComment('empty'));
      return roots as Node[];
    }
    const items = this[LOOP_DATA];
    const keyName = this[KEY_NAME];
    if (keyName !== 'index') this[KEYS] = [];
    if (!isArray(items) || items.length === 0) {
      roots.push(document.createComment('empty'));
      return roots as Node[];
    }
    this[LEN] = items.length;
    return renderItems(items, itemRenderFn, roots, this[KEYS], keyName, this[__][CONTEXT]);
  }

  _updateItem(index: number) {
    const items = this.loop;
    const roots = this[__].rootNodes;
    if (!isArray(items) || index >= roots.length) return;
    const keys = this._keys;
    const item = items[index];
    const oldEl = roots[index] as ForEachComponent;
    if (oldEl.each === item) {
      return;
    }
    const itemRenderFn = this[__].slots?.default;
    if (!itemRenderFn) return;
    // console.log('update item:', index);
    const keyName = this._keyName;
    if (keyName !== 'index') {
      const newKey = keyName === 'each' ? item : (keyName as ForKeyNameFn)(item);
      const oldKey = keys[index];
      if (newKey !== oldKey) {
        const $fd = oldEl.__firstDOM;
        const newEl = createEl(item, index, oldEl.isLast, itemRenderFn, this[__].context);
        const rr = newEl.__render();
        $fd.parentNode.insertBefore(rr.length > 1 ? createFragment(rr) : rr[0], $fd);
        oldEl.__destroy();
        roots[index] = newEl;
        keys[index] = newKey;
        newEl.__handleAfterRender();
        // console.log('update item render:', index);
      } else {
        oldEl.each = item as ViewModelObject;
      }
    } else {
      oldEl.each = item as ViewModelObject;
    }
  }

  __update() {
    this._waitingUpdate = false;
    // console.log('for update');
    const itemRenderFn = this[__].slots?.default;
    if (!itemRenderFn) return;

    const newItems: ViewModelArray = isArray(this.loop) ? this.loop : ([] as ViewModelArray);
    const roots = this[__].rootNodes;
    const nl = newItems.length;
    const ol = this._length;
    // nothing changed, return directly.
    if (nl === 0 && ol === 0) return;

    const keyName = this._keyName;
    // if new length equal 0, clear & render comment.
    if (nl === 0 && ol > 0) {
      const fd = (roots[0] as ForEachComponent).__firstDOM;
      const $cmt = document.createComment('empty');
      fd.parentNode.insertBefore($cmt, fd);
      for (let i = 0; i < ol; i++) {
        (roots[i] as ForEachComponent).__destroy();
      }
      roots.length = 1;
      roots[0] = $cmt;
      if (keyName !== 'index') {
        this._keys.length = 0;
      }
      this._length = 0;
      return;
    }

    this._length = nl;
    const ctx = this[__].context;
    const firstEl = roots[0]; // if ol === 0, firstEl is comment, else is component
    const $parent = (ol === 0 ? (firstEl as Node) : (firstEl as ForEachComponent).__firstDOM)
      .parentNode;

    if (keyName === 'index') {
      let $f: DocumentFragment = null;
      if (ol === 0) roots.length = 0;

      for (let i = 0; i < nl; i++) {
        if (i < ol) {
          updateEl(roots[i] as ForEachComponent, i, newItems);
        } else {
          if (!$f) $f = createFragment();
          const doms = appendRenderEach(newItems[i], i, i === nl - 1, itemRenderFn, roots, ctx);
          doms.forEach((el) => {
            $f.appendChild(el);
          });
        }
      }
      if ($f) {
        const $le = ol === 0 ? (firstEl as Node) : (roots[ol - 1] as ForEachComponent).__lastDOM;
        insertAfter($parent, $f, $le);
        for (let i = ol; i < nl; i++) {
          (roots[i] as ForEachComponent).__handleAfterRender();
        }
      }
      if (ol === 0) {
        $parent.removeChild(firstEl as Node);
      }
      if (nl >= ol) return;
      for (let i = nl; i < ol; i++) {
        (roots[i] as ForEachComponent).__destroy();
      }
      roots.splice(nl);

      return;
    }

    const oldKeys = this._keys;
    if (ol === 0) {
      roots.length = 0;
      const rs = renderItems(newItems, itemRenderFn, roots, oldKeys, keyName, this[__].context);
      insertAfter($parent, createFragment(rs), firstEl as Node);
      $parent.removeChild(firstEl as Node);
      for (const el of roots) {
        (el as ForEachComponent).__handleAfterRender();
      }
      return;
    }

    const oldKeyMap = new Map();
    oldKeys.forEach((k, i) => {
      oldKeyMap.set(k, i);
    });
    const newKeys: unknown[] = [];
    const newKeyMap = new Map();
    newItems.forEach((item, i) => {
      // _assertVm(item, i);
      newKeys.push(_prepareKey(item, i, newKeyMap, keyName));
    });

    let oi = 0;
    let ni = 0;
    let $lastS = null;
    const newRoots = [];
    const oldTags = new Uint8Array(ol);
    while (oi < ol || ni < nl) {
      while (oi < ol) {
        if (oldTags[oi] !== 0) {
          oi++;
        } else if (newKeyMap.has(oldKeys[oi]) && newKeyMap.get(oldKeys[oi]) >= ni) {
          if (oi === ol - 1) {
            $lastS = (roots[oi] as ForEachComponent).__lastDOM.nextSibling;
          }
          break;
        } else {
          if (oi === ol - 1) {
            $lastS = (roots[oi] as ForEachComponent).__lastDOM.nextSibling;
          }
          (roots[oi] as ForEachComponent).__destroy();
          oi++;
        }
      }
      if (oi >= ol) {
        let $f: DocumentFragment = null;
        const cei = newRoots.length;
        for (; ni < nl; ni++) {
          const el = createEl(newItems[ni], ni, ni === nl - 1, itemRenderFn, ctx);
          if (!$f) $f = createFragment();
          const doms = el.__render();
          doms.forEach(($n) => $f.appendChild($n));
          newRoots.push(el);
        }
        if ($f) {
          if ($lastS) {
            $parent.insertBefore($f, $lastS);
          } else {
            $parent.appendChild($f);
          }
          for (let i = cei; i < newRoots.length; i++) {
            (newRoots[i] as ForEachComponent).__handleAfterRender();
          }
        }
        break;
      }
      const oldKey = oldKeys[oi];
      let $f: DocumentFragment = null;
      let $nes: ForEachComponent[] = null;
      while (ni < nl) {
        const newKey = newKeys[ni];
        if (newKey === oldKey) break;

        let reuseEl: ForEachComponent = null;
        if (oldKeyMap.has(newKey)) {
          const oldIdx = oldKeyMap.get(newKey);
          if (oldIdx > oi && oldTags[oldIdx] === 0) {
            reuseEl = roots[oldIdx] as ForEachComponent;
            oldTags[oldIdx] = 1;
          }
        }
        if (!$f) $f = createFragment();
        if (!reuseEl) {
          reuseEl = createEl(newItems[ni], ni, ni === nl - 1, itemRenderFn, ctx);
          const doms = reuseEl.__render();
          doms.forEach(($n) => $f.appendChild($n));
          if (!$nes) $nes = [];
          $nes.push(reuseEl);
        } else {
          loopAppend($f, reuseEl);
          updateEl(reuseEl, ni, newItems);
        }
        newRoots.push(reuseEl);
        ni++;
      }
      if (ni >= nl) {
        throw new Error('unimpossible?!');
      }
      const el = roots[oi] as ForEachComponent;
      $f && $parent.insertBefore($f, el.__firstDOM);
      if ($nes?.length) {
        for (const el of $nes) {
          el.__handleAfterRender();
        }
      }
      updateEl(el, ni, newItems);
      newRoots.push(el);
      oi++;
      ni++;
    }

    this[__].rootNodes = newRoots;
    this._keys = newKeys;
  }
}
