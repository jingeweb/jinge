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
  CONTEXT,
  onAfterRender,
  getLastHtmlDOM
} from '../core/component';
import {
  isArray,
  Symbol,
  STR_DEFAULT,
  isObject,
  assert_fail,
  STR_EMPTY,
  STR_LENGTH,
  isNumber,
  isString
} from '../util';
import {
  createComment,
  createFragment,
  appendChild,
  getParent,
  insertBefore,
  removeChild,
  insertAfter
} from '../dom';
import {
  VM_PARENTS,
  VM_DEBUG_NAME
} from '../viewmodel/common';
import {
  wrapAttrs
} from '../viewmodel/proxy';
import {
  vmWatch
} from '../viewmodel/notify';

export const FOR_LENGTH = Symbol('length');
export const FOR_KEYS = Symbol('keys');
export const FOR_KEY_NAME = Symbol('key');
export const FOR_WAIT_UPDATE = Symbol('waiting_update');
export const FOR_UPDATE_ITEM = Symbol('update_item');

const KEY_INDEX = 'index';
const KEY_EACH = 'each';
const EMP_ARR = [];

export class ForEachComponent extends Component {
  constructor(attrs, item, index, isLast) {
    super(attrs);
    this.each = item;
    this.index = index;
    this.isFirst = index === 0;
    this.isLast = isLast;
  }
  [RENDER]() {
    const renderFn = this[ARG_COMPONENTS][STR_DEFAULT];
    if (!renderFn) assert_fail();
    return renderFn(this);
  }
}

function createEl(item, i, isLast, itemRenderFn, context) {
  return new ForEachComponent(wrapAttrs({
    [VM_DEBUG_NAME]: 'attrs_of_<for-each>',
    [CONTEXT]: context,
    [ARG_COMPONENTS]: {
      [STR_DEFAULT]: itemRenderFn
    }
  }), item, i, isLast);
}

function appendRenderEach(item, i, isLast, itemRenderFn, roots, context) {
  const el = createEl(item, i, isLast, itemRenderFn, context);
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
    result.push(...appendRenderEach(item, i, i === items.length - 1, itemRenderFn, roots, context));
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

function updateEl(el, i, items) {
  if (el.isFirst !== (i === 0)) {
    el.isFirst = i === 0;
  }
  if (el.isLast !== (i === items.length - 1)) {
    el.isLast = (i === items.length - 1);
  }
  if (el.index !== i) {
    el.index = i;
  }
  if (el.each !== items[i]) {
    el.each = items[i];
  }
}

function _parse_index_path(p) {
  return (isString(p) && p !== STR_LENGTH && /^\d+$/.test(p)) ? Number(p) : p;
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
    this[FOR_WAIT_UPDATE] = false;

    if (kn !== KEY_INDEX && kn !== KEY_EACH) {
      this[FOR_KEY_NAME] = new Function(KEY_EACH, `return ${kn}`);
      // console.log('loop.*.' + kn.slice(5));
      const propCount = kn.split('.').length + 1;
      // console.log(propCount);
      vmWatch(this, 'loop.*.' + kn.slice(5), propPath => {
        if (propPath.length !== propCount || this[FOR_WAIT_UPDATE]) {
          // ignore if it's parent path
          // or is alreay waiting for update
          // console.log('skip2', propPath);
          return;
        }
        // console.log(propPath);
        const items = this.loop;
        if (!isArray(items) || items.length === 0) return;
        const p = _parse_index_path(propPath[1]);
        if (!isNumber(p) || p >= items.length) {
          return;
        }
        // console.log('update item key:', p);
        this[FOR_KEYS][p] = this[FOR_KEY_NAME](items[p]);
      });
    }
    vmWatch(this, 'loop.*', propPath => {
      if (propPath.length !== 2 || this[FOR_WAIT_UPDATE]) {
        // if propPath.length === 1 means loop variable changed, loop setter will handle it.
        // ignore if is alreay waiting for update
        // console.log('skip', propPath);
        return;
      }
      // console.log(propPath);
      const p = _parse_index_path(propPath[1]);
      if (p === STR_LENGTH) {
        this[FOR_WAIT_UPDATE] = true;
        this[UPDATE_IF_NEED]();
        // this[FOR_UPDATE_TM] = setImmediate(this[FOR_UPDATE_HD]);
      } else if (isNumber(p)) {
        this[FOR_UPDATE_ITEM](p);
      }
    });
  }
  get loop() {
    return this._l;
  }
  set loop(v) {
    // console.log('set loop');
    this._l = v;
    this[FOR_WAIT_UPDATE] = true;
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
    return renderItems(
      items,
      itemRenderFn,
      roots,
      this[FOR_KEYS],
      keyName,
      this[CONTEXT]
    );
  }
  [FOR_UPDATE_ITEM](index) {
    const items = this.loop;
    const roots = this[ROOT_NODES];
    if (!isArray(items) || index >= roots.length) return;
    const keys = this[FOR_KEYS];
    const item = items[index];
    const oldEl = roots[index];
    if (oldEl.each === item) {
      return;
    }
    const itemRenderFn = this[ARG_COMPONENTS] ? this[ARG_COMPONENTS][STR_DEFAULT] : null;
    if (!itemRenderFn) return;
    // console.log('update item:', index);
    const keyName = this[FOR_KEY_NAME];
    if (keyName !== KEY_INDEX) {
      const newKey = keyName === KEY_EACH ? item : keyName(item);
      const oldKey = keys[index];
      if (newKey !== oldKey) {
        const $fd = getFirstHtmlDOM(oldEl);
        const newEl = createEl(
          item, index, oldEl.isLast, 
          itemRenderFn, this[CONTEXT]
        );
        const rr = newEl[RENDER]();
        insertBefore(getParent($fd), rr, $fd);
        oldEl[DESTROY]();
        roots[index] = newEl;
        keys[index] = newKey;
        onAfterRender(newEl);
        // console.log('update item render:', index);
      } else {
        oldEl.each = item;
      }
    } else {
      oldEl.each = item;
    }
  }
  [UPDATE]() {
    this[FOR_WAIT_UPDATE] = false;
    // console.log('for update');
    const itemRenderFn = this[ARG_COMPONENTS] ? this[ARG_COMPONENTS][STR_DEFAULT] : null;
    if (!itemRenderFn) return;

    const newItems = isArray(this.loop) ? this.loop : EMP_ARR;
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
    const firstEl = roots[0]; // if ol === 0, firstEl is comment, else is component
    const $parent = getParent(ol === 0 ? firstEl : getFirstHtmlDOM(firstEl));

    if (keyName === KEY_INDEX) {
      let $f = null;
      if (ol === 0) roots.length = 0;

      for(let i = 0; i < nl; i++) {
        if (i < ol) {
          updateEl(roots[i], i, newItems);
        } else {
          if (!$f) $f = createFragment();
          appendChild($f, ...appendRenderEach(newItems[i], i, i === nl - 1, itemRenderFn, roots, ctx));
        }
      }
      if ($f) {
        const $le = ol === 0 ? firstEl : getLastHtmlDOM(roots[ol - 1]);
        insertAfter($parent, $f, $le);
        for(let i = ol; i < nl; i++) {
          onAfterRender(roots[i]);
        }
      }
      if (ol === 0) {
        removeChild($parent, firstEl);
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
      roots.length = 0;
      const rs = renderItems(
        newItems, itemRenderFn, roots, 
        oldKeys, keyName, this[CONTEXT]
      );
      insertAfter($parent, createFragment(rs), firstEl);
      removeChild($parent, firstEl);
      roots.forEach(el => onAfterRender(el));
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
    let $lastS = null;
    const newRoots = [];
    const oldTags = new Uint8Array(ol);
    while(oi < ol || ni < nl) {
      while(oi < ol) {
        if (oldTags[oi] !== 0) {
          oi++;
        } else if (newKeyMap.has(oldKeys[oi]) && newKeyMap.get(oldKeys[oi]) >= ni) {
          if (oi === ol - 1) {
            $lastS = getLastHtmlDOM(roots[oi]).nextSibling;
          }
          break;
        } else {
          if (oi === ol - 1) {
            $lastS = getLastHtmlDOM(roots[oi]).nextSibling;
          }
          roots[oi][DESTROY]();
          oi++;
        }
      }
      if (oi >= ol) {
        let $f = null;
        const cei = newRoots.length;
        for(; ni < nl; ni++) {
          const el = createEl(newItems[ni], ni, ni === nl - 1, itemRenderFn, ctx);
          if (!$f) $f = createFragment();
          appendChild($f, ...el[RENDER]());
          newRoots.push(el);
        }
        if ($f) {
          if ($lastS) {
            insertBefore($parent, $f, $lastS);
          } else {
            appendChild($parent, $f);
          }
          for(let i = cei; i < newRoots.length; i++) {
            onAfterRender(newRoots[i]);
          }
        }
        break;
      }
      const oldKey = oldKeys[oi];
      let $f = null;
      let $nes = null;
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
          reuseEl = createEl(newItems[ni], ni, ni === nl - 1, itemRenderFn, ctx);
          appendChild($f, ...reuseEl[RENDER]());
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
        assert_fail('unimpossible?!');
      }
      const el = roots[oi];
      $f && insertBefore($parent, $f, getFirstHtmlDOM(el));
      $nes && $nes.forEach(el => onAfterRender(el));
      updateEl(el, ni, newItems);
      newRoots.push(el);
      oi++;
      ni++;
    }

    this[ROOT_NODES] = newRoots;
    this[FOR_KEYS] = newKeys;

  }
}