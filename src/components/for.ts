import {
  Component, ComponentAttributes, __, attrs, RenderFn, isComponent, ComponentStates, assertRenderResults
} from '../core/component';
import {
  isViewModel, ViewModelArray, $$, ViewModelObject
} from '../vm/common';
import {
  isString, isNumber, isArray, createFragment, insertAfter
} from '../util';

type ForKeyNameFn = (v: unknown) => string;
type ForKeyName = string | ForKeyNameFn;

export class ForEachComponent extends Component {
  _e: ViewModelObject;
  index: number;
  isFirst: boolean;
  isLast: boolean;

  constructor(attrs: ComponentAttributes, item: unknown, index: number, isLast: boolean) {
    super(attrs);
    if (isViewModel(item)) {
      this.each = item as ViewModelObject;
    } else {
      this._e = item as ViewModelObject;
    }
    this.index = index;
    this.isFirst = index === 0;
    this.isLast = isLast;
  }

  get each(): ViewModelObject {
    return this._e;
  }

  set each(v: ViewModelObject) {
    this._e = v;
  }

  __render(): Node[] {
    return this[__].slots.default(this);
  }
}

function createEl(item: unknown, i: number, isLast: boolean, itemRenderFn: RenderFn, context: Record<string | symbol, unknown>, parentCompomentStyles: Record<string, string>): ForEachComponent {
  return (new ForEachComponent(attrs({
    [__]: {
      context,
      compStyle: parentCompomentStyles,
      slots: {
        default: itemRenderFn
      }
    }
  }), item, i, isLast))[$$].proxy as ForEachComponent;
}

function appendRenderEach(item: unknown, i: number, isLast: boolean, itemRenderFn: RenderFn, roots: (Component | Node)[], context: Record<string | symbol, unknown>, parentCompomentStyles: Record<string, string>): Node[] {
  const el = createEl(item, i, isLast, itemRenderFn, context, parentCompomentStyles);
  roots.push(el);
  return el.__render();
}

// function _assertVm(item, i) {
//   if (isObject(item) && !isInnerObj(item) && !(VM_ATTRS in item)) {
//     throw new Error(`loop item [${i}] of <for> component must be ViewModel.`);
//   }
// }

function _prepareKey(item: unknown, i: number, keyMap: Map<unknown, number>, keyName: ForKeyName): unknown {
  const key = keyName === 'each' ? item : (keyName as ForKeyNameFn)(item);
  if (keyMap.has(key)) {
    // eslint-disable-next-line no-console
    console.error(`loop items [${i}] and [${keyMap.get(key)}] of <for> component both have key '${key}', dulplicated key may cause update error.`);
  }
  keyMap.set(key, i);
  return key;
}

function renderItems(items: unknown[], itemRenderFn: RenderFn, roots: (Component | Node)[], keys: unknown[], keyName: ForKeyName, context: Record<string | symbol, unknown>, parentCompomentStyles: Record<string, string>): Node[] {
  const result: Node[] = [];
  const tmpKeyMap = new Map();
  items.forEach((item, i) => {
    // _assertVm(item, i);
    if (keyName !== 'index') {
      keys.push(_prepareKey(item, i, tmpKeyMap, keyName));
    }
    result.push(...appendRenderEach(item, i, i === items.length - 1, itemRenderFn, roots, context, parentCompomentStyles));
  });
  return result;
}

function loopAppend($parent: Node, el: Component): void {
  el[__].rootNodes.forEach(node => {
    if (isComponent(node)) {
      loopAppend($parent, node as Component);
    } else {
      $parent.appendChild(node as Node);
    }
  });
}

function updateEl(el: ForEachComponent, i: number, items: unknown[]): void {
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
    el.each = items[i] as ViewModelObject;
  }
}

function _parseIndexPath(p: string | number): string | number {
  return (isString(p) && p !== 'length' && /^\d+$/.test(p as string)) ? Number(p) : p;
}

export class ForComponent extends Component {
  _l: ViewModelArray;
  _keyName: ForKeyName;
  _length: number;
  _keys: unknown[];
  _waitingUpdate: boolean;

  constructor(attrs: ComponentAttributes) {
    if (attrs.key && !/^(index|each(.[\w\d$_]+)*)$/.test(attrs.key as string)) {
      throw new Error('Value of "key" attribute of <for> component is invalidate. See https://[todo]');
    }
    super(attrs);

    /**
     * <for> 组件的 loop 属性可以支持不是 ViewModel 的数组，因此直接通过
     * this._l = attrs.loop 的形式初始化赋值。
     */
    if (isViewModel(attrs.loop)) {
      this.loop = attrs.loop as ViewModelArray;
    } else {
      this._l = attrs.loop as ViewModelArray;
    }
    /**
     * 上面的写法，编译器将不会自动生成对 attrs 的 VM_ON('loop') 代码。
     * 只有直接在构造函数体里最顶部的 this.xxx = attrs.xxx 的赋值形式才会，
     * 而上面的 this.loop = attrs.loop 写在了 if 的条件内部，需要手动添加监听代码。
     */
    attrs[$$].__watch('loop', () => {
      this.loop = attrs.loop as ViewModelArray;
    });

    const kn = attrs.key as string || 'index';
    this._keyName = kn;
    this._length = 0;
    this._keys = null;
    this._waitingUpdate = false;

    if (kn !== 'index' && kn !== 'each') {
      /* eslint no-new-func:"off" */
      this._keyName = new Function('each', `return ${kn}`) as ForKeyNameFn;
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
        this._keys[p as number] = (this._keyName as ForKeyNameFn)(items[p]);
      });
    }
    this[$$].__watch('loop.*', (propPath: (string | number)[]) => {
      if (this[__].state !== ComponentStates.RENDERED || propPath.length !== 2 || this._waitingUpdate) {
        // if propPath.length === 1 means loop variable changed, loop setter will handle it.
        // ignore if is alreay waiting for update
        // console.log('skip', propPath);
        return;
      }
      // console.log(propPath);
      const p = _parseIndexPath(propPath[1]);
      if (p === 'length') {
        this._waitingUpdate = true;
        this.__updateIfNeed();
      } else if (isNumber(p)) {
        this._updateItem(p as number);
      }
    });
  }

  get loop(): ViewModelArray {
    return this._l;
  }

  set loop(v: ViewModelArray) {
    // console.log('set loop');
    this._l = v;
    this._waitingUpdate = true;
    this.__updateIfNeed();
  }

  __render(): Node[] {
    const roots = this[__].rootNodes;
    const itemRenderFn = this[__].slots?.default;
    if (!itemRenderFn) {
      roots.push(document.createComment('empty'));
      return roots as Node[];
    }
    const items = this.loop;
    const keyName = this._keyName;
    if (keyName !== 'index') this._keys = [];
    if (!isArray(items) || items.length === 0) {
      roots.push(document.createComment('empty'));
      return roots as Node[];
    }
    this._length = items.length;
    return renderItems(
      items,
      itemRenderFn,
      roots,
      this._keys,
      keyName,
      this[__].context,
      this[__].compStyle
    );
  }

  _updateItem(index: number): void {
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
        const newEl = createEl(
          item, index, oldEl.isLast,
          itemRenderFn, this[__].context, this[__].compStyle
        );
        const rr = assertRenderResults(newEl.__render());
        $fd.parentNode.insertBefore(
          rr.length > 1 ? createFragment(rr) : rr[0], $fd
        );
        oldEl.__destroy();
        roots[index] = newEl;
        keys[index] = newKey;
        newEl.__handleAfterRender();
        // console.log('update item render:', index);
      } else {
        oldEl.each = item;
      }
    } else {
      oldEl.each = item;
    }
  }

  __update(): void {
    this._waitingUpdate = false;
    // console.log('for update');
    const itemRenderFn = this[__].slots?.default;
    if (!itemRenderFn) return;

    const newItems: ViewModelArray = isArray(this.loop) ? this.loop : [] as ViewModelArray;
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
    const parentComponentStyles = this[__].compStyle;
    const firstEl = roots[0]; // if ol === 0, firstEl is comment, else is component
    const $parent = (ol === 0 ? firstEl as Node : (firstEl as ForEachComponent).__firstDOM).parentNode;

    if (keyName === 'index') {
      let $f: DocumentFragment = null;
      if (ol === 0) roots.length = 0;

      for (let i = 0; i < nl; i++) {
        if (i < ol) {
          updateEl(roots[i] as ForEachComponent, i, newItems);
        } else {
          if (!$f) $f = createFragment();
          appendRenderEach(newItems[i], i, i === nl - 1, itemRenderFn, roots, ctx, parentComponentStyles).forEach(el => {
            $f.appendChild(el);
          });
        }
      }
      if ($f) {
        const $le = ol === 0 ? firstEl as Node : (roots[ol - 1] as ForEachComponent).__lastDOM;
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
      const rs = renderItems(
        newItems, itemRenderFn, roots,
        oldKeys, keyName, this[__].context, this[__].compStyle
      );
      insertAfter($parent, createFragment(rs), firstEl as Node);
      $parent.removeChild(firstEl as Node);
      roots.forEach(el => (el as ForEachComponent).__handleAfterRender());
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
          const el = createEl(newItems[ni], ni, ni === nl - 1, itemRenderFn, ctx, parentComponentStyles);
          if (!$f) $f = createFragment();
          el.__render().forEach($n => $f.appendChild($n));
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
          reuseEl = createEl(newItems[ni], ni, ni === nl - 1, itemRenderFn, ctx, parentComponentStyles);
          reuseEl.__render().forEach($n => $f.appendChild($n));
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
      $nes && $nes.forEach(el => el.__handleAfterRender());
      updateEl(el, ni, newItems);
      newRoots.push(el);
      oi++;
      ni++;
    }

    this[__].rootNodes = newRoots;
    this._keys = newKeys;
  }
}
