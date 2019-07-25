/* eslint-disable */
/**
 * This file has been deprecated.
 * 这个 <for> 组件的实现采用 diff 算法来处理， 性能很差，已废弃
 */
import {
  Component,
  RENDER,
  ROOT_NODES,
  ARG_COMPONENTS,
  UPDATE_IF_NEED,
  UPDATE,
  DESTROY,
  isComponent
} from '../core/component';
import {
  isArray,
  Symbol,
  STR_DEFAULT,
  isObject,
  diffArray,
  assertFail
} from '../util';
import {
  createComment,
  createFragment,
  appendChild,
  getParent,
  insertBefore
} from '../dom';
import {
  VM_PARENTS
} from '../viewmodel/common';

export const FOR_KEYS = Symbol('keys');
export const FOR_KEY_NAME = Symbol('key');

const KEY_INDEX = 'index';
const EMP_ARR = [];

export class ForEachComponent extends Component {
  constructor(renderFn, item, index) {
    super(renderFn);
    this.each = item;
    this.index = index;
  }

  [RENDER]() {
    const renderFn = this[ARG_COMPONENTS][STR_DEFAULT];
    if (!renderFn) assertFail();
    const result = renderFn(this);
    if (result.length <= 0) {
      /*
       * if rendered result is empty, we will insert a comment
       * to insure getFirstHtmlNode function call won't fail.
       */
      const $cmt = createComment('empty');
      this[ROOT_NODES].unshift($cmt);
      result.push($cmt);
    }
    return result;
  }
}
function getFirstHtmlNode(el) {
  const ns = el[ROOT_NODES];
  if (!ns || ns.length === 0) assertFail();
  if (isComponent(ns[0])) return getFirstHtmlNode(ns[0]);
  else return ns[0];
}

function appendRenderEach(item, i, itemRenderFn, roots) {
  const el = new ForEachComponent(itemRenderFn, item, i);
  roots.push(el);
  return el[RENDER]();
}

function assert_vm(item, i) {
  if (item !== null && isObject(item) && !(VM_PARENTS in item)) {
    throw new Error(`<for>: array item [${i}] must be ViewModel.`);
  }
}

function prepare_key(item, i, tmpKeyMap, keyName) {
  const key = keyName(item);
  if (tmpKeyMap.has(key)) {
    console.warn(`<for>: array item [${i}] and [${tmpKeyMap.get(key)}] both have key '${key}', dulplicated key may cause update error.`);
  } else {
    tmpKeyMap.set(key, i);
  }
  return key;
}
function renderItems(items, itemRenderFn, roots, keys, keyName) {
  const result = [];
  const tmpKeyMap = new Map();
  items.forEach((item, i) => {
    assert_vm(item, i);
    if (keyName !== KEY_INDEX) {
      keys.push(prepare_key(item, i, tmpKeyMap, keyName));
    }
    result.push(...appendRenderEach(item, i, itemRenderFn, roots));
  });
  return result;
}
function loopAppend($parent, el) {
  el[ROOT_NODES].forEach(node => {
    if (isComponent(node)) {
      loopAppend($parent, node);
    } else {
      appendChild($parent, node);
    }
  });
}
export class ForComponent extends Component {
  constructor(attrs) {
    const kn = attrs._key;
    if (!kn) throw new Error('<for>: require "_key" attribute.');
    if (!kn || !/^(index|each(.[\w\d$_]+)*)$/.test(kn)) {
      throw new Error('<for>: bad "_key" attribute value. See https://[todo]');
    }
    super(attrs);
    this.loop = attrs.loop;
    this[FOR_KEY_NAME] = attrs._key;
    this[FOR_KEYS] = null;
    if (kn !== KEY_INDEX) {
      this[FOR_KEY_NAME] = new Function('each', `return ${kn}`);
    }
  }

  get loop() {
    return this._l;
  }

  set loop(v) {
    this._l = v;
    this[UPDATE_IF_NEED]();
  }

  [RENDER]() {
    const items = this.loop;
    const roots = this[ROOT_NODES];
    const $cmt = createComment(' <for> ');
    roots.push($cmt);
    const itemRenderFn = this[ARG_COMPONENTS] ? this[ARG_COMPONENTS][STR_DEFAULT] : null;
    if (!itemRenderFn) return roots;
    const keyName = this[FOR_KEY_NAME];
    if (keyName !== KEY_INDEX) this[FOR_KEYS] = [];
    if (!isArray(items) || items.length === 0) {
      return roots;
    }
    const result = renderItems(items, itemRenderFn, roots, this[FOR_KEYS], keyName);
    result.unshift($cmt);
    return result;
  }

  [UPDATE]() {
    const itemRenderFn = this[ARG_COMPONENTS] ? this[ARG_COMPONENTS][STR_DEFAULT] : null;
    if (!itemRenderFn) return;

    const newItems = Array.isArray(this.loop) ? this.loop : EMP_ARR;
    const roots = this[ROOT_NODES];
    const nl = newItems.length;
    const ol = roots.length - 1;
    // nothing changed, return directly.
    if (nl === 0 && ol === 0) return;

    const keyName = this[FOR_KEY_NAME];
    const $parent = getParent(roots[0]);

    if (keyName === KEY_INDEX) {
      const st = Date.now();
      let $f = null;
      for (let i = 0; i < nl; i++) {
        if (i < ol) {
          const el = roots[i + 1];
          if (newItems[i] !== el.each) {
            el.each = newItems[i];
          }
        } else {
          if (!$f) $f = createFragment();
          appendChild($f, ...appendRenderEach(newItems[i], i, itemRenderFn, roots));
        }
      }
      if ($f) {
        appendChild($parent, $f);
      }
      if (nl >= ol) return console.log(Date.now() - st);
      for (let i = nl; i < ol; i++) {
        roots[i + 1][DESTROY]();
      }
      roots.splice(1 + nl);
      console.log(Date.now() - st);
      return;
    }

    const oldKeys = this[FOR_KEYS];

    /**
     * if length of new array equal 0 or length of old array equal 0,
     *   do not need compare diffs,
     *   this is a special optimization.
     */
    if (nl === 0) {
      for (let i = 0; i < ol; i++) {
        roots[i + 1][DESTROY]();
      }
      roots.length = 1;
      oldKeys.length = 0;
      return;
    }
    if (ol === 0) {
      const rs = renderItems(newItems, itemRenderFn, roots, oldKeys, keyName);
      appendChild($parent, createFragment(rs));
      return;
    }

    let st = Date.now();
    // TODO: do we need better diff algorithm & better dom performance?
    const tmpKeyMap = new Map();
    const newKeys = EMP_ARR.map.call(newItems, (item, i) => {
      assert_vm(item, i);
      return prepare_key(item, i, tmpKeyMap, keyName);
    });
    console.log(Date.now() - st);
    st = Date.now();
    const diffs = diffArray(oldKeys, newKeys);
    if (!diffs || diffs.length === 0) {
      // This should never happen, but we want to be safe.
      return;
    }
    console.log(Date.now() - st);
    st = Date.now();
    let newRoots = null;
    // First loop, calculate all reused nodes.
    let oldIdx = 0;
    const reusedMap = new Map();
    diffs.forEach(diff => {
      if (diff.type === -1) {
        diff.value.forEach((oldKey, i) => {
          if (tmpKeyMap.has(oldKey) && !reusedMap.has(oldKey)) { // reused.
            reusedMap.set(oldKey, roots[1 + oldIdx + i]);
          } else { // not resued, destroy.
            roots[1 + oldIdx + i][DESTROY]();
          }
        });
        oldIdx += diff.count;
      } else if (diff.type === 0) {
        if (oldIdx === 0 && diff.count === ol) {
          newRoots = roots;
        } else {
          const slice = roots.slice(1 + oldIdx, 1 + oldIdx + diff.count);
          newRoots = (newRoots || [roots[0]]).concat(slice);
        }
        oldIdx += diff.count;
      }
    });
    console.log(Date.now() - st);
    st = Date.now();
    if (!newRoots) assertFail(); // this should never happen

    // Second loop, move reused nodes or insert new nodes
    oldIdx = 0;
    let newIdx = 0;
    diffs.forEach(diff => {
      if (diff.type === -1) { // removed
        oldIdx += diff.count;
      } else if (diff.type === 1) { // added
        const $rd = (newIdx + 1 > newRoots.length - 1) ? null : getFirstHtmlNode(newRoots[newIdx + 1]);

        const $f = createFragment();

        diff.value.forEach((newKey, i) => {
          const idx = newIdx + i;
          const item = newItems[idx];
          let el;
          if (reusedMap.has(newKey)) {
            el = reusedMap.get(newKey);
            loopAppend($f, el);
            if (el.index !== idx) {
              el.index = idx;
            }
            if (el.each !== item) {
              el.each = item;
            }
          } else {
            el = new ForEachComponent(itemRenderFn, item, idx);
            appendChild($f, ...el[RENDER]());
          }
          newRoots.splice(1 + idx, 0, el);
        });
        if ($rd) insertBefore($parent, $f, $rd);
        else appendChild($parent, $f);
        newIdx += diff.count;
      } else { // key and dom position not changed.
        for (let i = 0; i < diff.count; i++) {
          const el = roots[1 + oldIdx + i];
          const it = newItems[newIdx + i];
          if (el.each !== it) {
            el.each = it;
          }
          if (el.index !== newIdx + i) {
            el.index = newIdx + i;
          }
        }
        oldIdx += diff.count;
        newIdx += diff.count;
      }
    });
    console.log(Date.now() - st);
    st = Date.now();
    this[ROOT_NODES] = newRoots;
    this[FOR_KEYS] = newKeys;
  }
}
