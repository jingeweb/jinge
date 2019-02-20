import {
  Component,
  RENDER,
  ROOT_NODES,
  ARG_COMPONENTS,
  UPDATE_IF_NEED,
  UPDATE,
  DESTROY,
  isComponent,
  getFirstHtmlDOM,
  CONTEXT
} from '../core/component';
import {
  isArray,
  Symbol,
  STR_DEFAULT,
  isObject,
  assert_fail,
  STR_EMPTY
} from '../util';
import {
  createComment,
  createFragment,
  appendChild,
  getParent,
  insertBefore,
  removeChild
} from '../dom';
import {
  VM_PARENTS
} from '../viewmodel/common';
import { wrapViewModel } from '../viewmodel/proxy';

export const FOR_LENGTH = Symbol('length');
export const FOR_KEYS = Symbol('keys');
export const FOR_KEY_NAME = Symbol('key');

const KEY_INDEX = 'index';
const KEY_EACH = 'each';
const EMP_ARR = [];
// let DEBUG_INC = 0;

export class ForEachComponent extends Component {
  constructor(attrs, item, index) {
    super(attrs);
    this.each = item;
    this.index = index;
  }
  [RENDER]() {
    const renderFn = this[ARG_COMPONENTS][STR_DEFAULT];
    if (!renderFn) assert_fail();
    return renderFn(this);
  }
}

function createEl(item, i, itemRenderFn, context) {
  return new ForEachComponent(wrapViewModel({
    [CONTEXT]: context,
    [ARG_COMPONENTS]: {
      [STR_DEFAULT]: itemRenderFn
    }
  }), item, i);
}

function appendRenderEach(item, i, itemRenderFn, roots, context) {
  const el = createEl(item, i, itemRenderFn, context);
  roots.push(el);
  return el[RENDER]();
}

function assert_vm(item, i) {
  if (item !== null && isObject(item) && !(VM_PARENTS in item)) {
    throw new Error(`loop item [${i}] of <for> component must be ViewModel.`);
  }
}

function prepare_key(item, i, keyMap, keyName) {
  const key = keyName === KEY_EACH ? item : keyName(item);
  if (keyMap.has(key)) {
    console.error(`loop items [${i}] and [${keyMap.get(key)}] of <for> component both have key '${key}', dulplicated key may cause update error.`);
  }
  keyMap.set(key, i);
  return key;
}
function renderItems(items, itemRenderFn, roots, keys, keyName, context) {
  const result = [];
  const tmpKeyMap = new Map();
  items.forEach((item, i) => {
    assert_vm(item, i);
    if (keyName !== KEY_INDEX) {
      keys.push(prepare_key(item, i, tmpKeyMap, keyName));  
    }
    result.push(...appendRenderEach(item, i, itemRenderFn, roots, context));
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
    const kn = attrs._key || KEY_INDEX;
    if (kn && !/^(index|each(.[\w\d$_]+)*)$/.test(kn)) {
      throw new Error('Value of "_key" attribute of <for> component is invalidate. See https://[todo]');
    }
    super(attrs);
    this.loop = attrs.loop;
    this[FOR_KEY_NAME] = kn;
    this[FOR_LENGTH] = 0;
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
    const roots = this[ROOT_NODES];
    const itemRenderFn = this[ARG_COMPONENTS] ? this[ARG_COMPONENTS][STR_DEFAULT] : null;
    if (!itemRenderFn) {
      roots.push(createComment(STR_EMPTY));
      return roots;
    }
    const items = this.loop;
    const keyName = this[FOR_KEY_NAME];
    if (keyName !== KEY_INDEX) this[FOR_KEYS] = [];
    if (!isArray(items) || items.length === 0) {
      roots.push(createComment(STR_EMPTY));
      return roots;
    }
    this[FOR_LENGTH] = items.length;
    return renderItems(items, itemRenderFn, roots, this[FOR_KEYS], keyName, this[CONTEXT]);
  }
  [UPDATE]() {
    const itemRenderFn = this[ARG_COMPONENTS] ? this[ARG_COMPONENTS][STR_DEFAULT] : null;
    if (!itemRenderFn) return;

    const newItems = Array.isArray(this.loop) ? this.loop : EMP_ARR;
    const roots = this[ROOT_NODES];
    const nl = newItems.length;
    const ol = this[FOR_LENGTH];
    // nothing changed, return directly.
    if (nl === 0 && ol === 0) return;

    const keyName = this[FOR_KEY_NAME];
    // if new length equal 0, clear & render comment.
    if (nl === 0 && ol > 0) {
      const fd = getFirstHtmlDOM(roots[0]);
      const $cmt = createComment(STR_EMPTY);
      insertBefore(getParent(fd), $cmt, fd);
      for(let i = 0; i < ol; i++) {
        roots[i][DESTROY]();
      }
      roots.length = 1;
      roots[0] = $cmt;
      if (keyName !== KEY_INDEX) {
        this[FOR_KEYS].length = 0;
      }
      this[FOR_LENGTH] = 0;
      return;
    }

    this[FOR_LENGTH] = nl;
    const ctx = this[CONTEXT];
    const $parent = getParent(ol === 0 ? roots[0] : getFirstHtmlDOM(roots[0]));
    if (ol === 0) {
      removeChild($parent, roots[0]);
      roots.length = 0;
    }

    if (keyName === KEY_INDEX) {
      let $f = null;
      for(let i = 0; i < nl; i++) {
        if (i < ol) {
          const el = roots[i];
          if (newItems[i] !== el.each) {
            el.each = newItems[i];
          }
        } else {
          if (!$f) $f = createFragment();
          appendChild($f, ...appendRenderEach(newItems[i], i, itemRenderFn, roots, ctx));
        }
      }
      if ($f) {
        appendChild($parent, $f);
      }
      if (nl >= ol) return;
      for(let i = nl; i < ol; i++) {
        roots[i][DESTROY]();
      }
      roots.splice(nl);
      return;
    }

    const oldKeys = this[FOR_KEYS];
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
    const newRoots = [];
    const oldTags = new Uint8Array(ol);
    while(oi < ol || ni < nl) {
      while(oi < ol) {
        if (oldTags[oi] !== 0) {
          oi++;
        } else if (newKeyMap.has(oldKeys[oi]) && newKeyMap.get(oldKeys[oi]) >= ni) {
          break;
        } else {
          roots[oi][DESTROY]();
          oi++;
        }
      }
      if (oi >= ol) {
        let $f = null;
        for(; ni < nl; ni++) {
          const el = createEl(newItems[ni], ni, itemRenderFn, ctx);
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
            reuseEl = roots[oldIdx];
            oldTags[oldIdx] = 1;
          } 
        }
        if (!$f) $f = createFragment();
        if (!reuseEl) {
          reuseEl = createEl(newItems[ni], ni, itemRenderFn, ctx);
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
      const el = roots[oi];
      $f && insertBefore($parent, $f, getFirstHtmlDOM(el));
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