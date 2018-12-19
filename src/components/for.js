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
  assert_fail
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
const KEY_EACH = 'each';
const EMP_ARR = [];
// let DEBUG_INC = 0;

export class ForEachComponent extends Component {
  constructor(renderFn, item, index) {
    super(renderFn);
    this.each = item;
    this.index = index;
  }
  [RENDER]() {
    const renderFn = this[ARG_COMPONENTS][STR_DEFAULT];
    if (!renderFn) assert_fail();
    return renderFn(this);
  }
}
function getFirstHtmlNode(el) {
  const ns = el[ROOT_NODES];
  if (!ns || ns.length === 0) assert_fail();
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

function prepare_key(item, i, keyMap, keyName) {
  const key = keyName === KEY_EACH ? item : keyName(item);
  if (keyMap.has(key)) {
    console.error(`<for>: array item [${i}] and [${keyMap.get(key)}] both have key '${key}', dulplicated key may cause update error.`);
  }
  keyMap.set(key, i);
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
    if (kn !== KEY_INDEX && kn !== KEY_EACH) {
      this[FOR_KEY_NAME] = new Function(KEY_EACH, `return ${kn}`);
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
      // const st = Date.now();
      let $f = null;
      for(let i = 0; i < nl; i++) {
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
      if (nl >= ol) return;
      for(let i = nl; i < ol; i++) {
        roots[i + 1][DESTROY]();
      }
      roots.splice(1 + nl);
      return;
    }

    const oldKeys = this[FOR_KEYS];

    /**
     * if length of new array equal 0 or length of old array equal 0,
     *   do not need compare diffs,
     *   this is a special optimization.
     */
    if (nl === 0) {
      for(let i = 0; i < ol; i++) {
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

    const oldKeyMap = new Map();
    oldKeys.forEach((k, i) => {
      oldKeyMap.set(k, i);
    });
    const newKeys = [];
    const newKeyMap = new Map();
    newItems.forEach((item, i) => {
      assert_vm(item, i);
      newKeys.push(prepare_key(item, i, newKeyMap, keyName));
    });
    
    let oi = 0;
    let ni = 0;
    const newRoots = [roots[0]];
    const oldTags = new Uint8Array(ol);
    while(oi < ol || ni < nl) {
      while(oi < ol) {
        if (oldTags[oi] !== 0) {
          oi++;
        } else if (newKeyMap.has(oldKeys[oi]) && newKeyMap.get(oldKeys[oi]) >= ni) {
          break;
        } else {
          roots[1 + oi][DESTROY]();
          oi++;
        }
      }
      if (oi >= ol) {
        let $f = null;
        for(; ni < nl; ni++) {
          const el = new ForEachComponent(itemRenderFn, newItems[ni], ni);
          if (!$f) $f = createFragment();
          appendChild($f, ...el[RENDER]());
          newRoots.push(el);
        }
        if ($f) appendChild($parent, $f);
        break;
      }
      const oldKey = oldKeys[oi];
      let $f = null;
      while(ni < nl) {
        const newKey = newKeys[ni];
        if (newKey === oldKey) break;
        
        let reuseEl = null;
        if (oldKeyMap.has(newKey)) {
          const oldIdx = oldKeyMap.get(newKey);
          if (oldIdx > oi && oldTags[oldIdx] === 0) {
            reuseEl = roots[1 + oldIdx];
            oldTags[oldIdx] = 1;
          } 
        }
        if (!$f) $f = createFragment();
        if (!reuseEl) {
          reuseEl = new ForEachComponent(itemRenderFn, newItems[ni], ni);
          appendChild($f, ...reuseEl[RENDER]());
        } else {
          loopAppend($f, reuseEl);
          if (reuseEl.index !== ni) reuseEl.index = ni;
          if (reuseEl.each !== newItems[ni]) reuseEl.each = newItems[ni];
        }
        newRoots.push(reuseEl);
        ni++;
      }
      if (ni >= nl) {
        assert_fail('unimpossible?!');
      }
      const el = roots[1 + oi];
      $f && insertBefore($parent, $f, getFirstHtmlNode(el));
      if (el.index !== ni) el.index = ni;
      if (el.each !== newItems[ni]) el.each = newItems[ni];
      newRoots.push(el);
      oi++;
      ni++;
    }
    this[ROOT_NODES] = newRoots;
    this[FOR_KEYS] = newKeys;

  }
}