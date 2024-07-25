import { arrayEqual, throwErr, clearImmediate, setImmediate } from '../util';
import type { PropertyPathItem } from '../vm';
import { VM_WATCHER_VALUE, $$, getValueByPath, innerWatchPath } from '../vm';
import { RELATED_WATCH } from './common';
import type { Component } from './component';

////// 这个文件里的函数都是用于给编译器转译 tsx 时使用的 Component 的 watch 函数。 /////
////// 业务中请直接使用 `watch` 函数进行 Component 或 ViewModel 的监听。        /////

export function watchForComponent(
  target: Component,
  watcher: Pick<
    ViewWatcher,
    typeof VM_WATCHER_DESTROY | typeof VM_WATCHER_PARENT | typeof VM_WATCHER_VALUE
  >,
  renderFn: (v: unknown) => void,
  relatedComponent?: Component,
) {
  watcher[VM_WATCHER_PARENT] = {
    [VM_WATCHER_NOTIFY]: renderFn,
  };
  renderFn(watcher[VM_WATCHER_VALUE]);

  if (relatedComponent && relatedComponent !== target) {
    let rw = relatedComponent[RELATED_WATCH];
    if (!rw) rw = relatedComponent[RELATED_WATCH] = [];
    rw.push(() => {
      watcher[VM_WATCHER_DESTROY]();
    });
  }
}

const VM_WATCHER_PARENT = Symbol('PARENT');
const VM_WATCHER_NOTIFY = Symbol('NOTIFY');
const VM_WATCHER_DESTROY = Symbol('DESTROY');
interface ViewWatcher {
  [VM_WATCHER_DESTROY]: () => void;
  [VM_WATCHER_NOTIFY]: (v: unknown) => void;
  [VM_WATCHER_PARENT]: ParentWatcher;
  [VM_WATCHER_VALUE]?: unknown;
}
type ParentWatcher = Pick<ViewWatcher, typeof VM_WATCHER_NOTIFY>;
export function PathWatcher(
  target: Component,
  path: PropertyPathItem[],
  deep = false,
): ViewWatcher {
  const core = target[$$];
  if (!core) throwErr('watch-not-vm');

  let val = getValueByPath(target, path);
  let parent: ParentWatcher | undefined = undefined;
  const unwatchFn = innerWatchPath(
    target,
    core,
    val,
    (v) => {
      val = v;
      parent?.[VM_WATCHER_NOTIFY](v);
    },
    path,
    deep,
  );
  return {
    [VM_WATCHER_DESTROY]() {
      parent = undefined;
      unwatchFn();
    },
    get [VM_WATCHER_VALUE]() {
      return val;
    },
    set [VM_WATCHER_PARENT](v: ParentWatcher) {
      parent = v;
    },
  } as ViewWatcher;
}
export function ExprWatcher(path: ViewWatcher[], fn: (...args: unknown[]) => void) {
  let val = fn(...path.map((w) => w[VM_WATCHER_VALUE]));
  let parent: ParentWatcher | undefined = undefined;
  let imm: number = 0;
  const update = () => {
    imm = 0;
    const newVal = fn(...path.map((w) => w[VM_WATCHER_VALUE]));
    if (newVal !== val) {
      val = newVal;
      parent?.[VM_WATCHER_NOTIFY](val);
    }
  };
  const rtn = {
    [VM_WATCHER_DESTROY]() {
      path.forEach((w) => w[VM_WATCHER_DESTROY]());
      parent = undefined;
      if (imm > 0) {
        clearImmediate(imm);
        imm = 0;
      }
    },
    get [VM_WATCHER_VALUE]() {
      return val;
    },
    set [VM_WATCHER_PARENT](v: ParentWatcher) {
      parent = v;
    },
    [VM_WATCHER_NOTIFY]() {
      if (imm > 0) clearImmediate(imm);
      imm = setImmediate(update);
    },
  } as ViewWatcher;
  path.forEach((w) => (w[VM_WATCHER_PARENT] = rtn));
  return rtn;
}

export function DymPathWatcher(
  target: Component,
  path: (PropertyPathItem | ViewWatcher)[],
  renderFn?: (v: unknown) => void,
) {
  const core = target[$$];
  if (!core) throwErr('watch-not-vm');
  let innerPath = path.map((p) => (typeof p === 'object' ? (p[VM_WATCHER_VALUE] as string) : p));
  let val = getValueByPath(target, innerPath);
  renderFn?.(val);
  let parent: ParentWatcher | undefined = undefined;
  const __innerW = () => {
    return innerWatchPath(
      target,
      core,
      val,
      (v) => {
        val = v;
        parent?.[VM_WATCHER_NOTIFY](v);
        renderFn?.(v);
      },
      innerPath,
      renderFn !== undefined,
    );
  };
  let unwatchFn = __innerW();
  const rtn = {
    [VM_WATCHER_DESTROY]() {
      parent = undefined;
      unwatchFn();
    },
    get [VM_WATCHER_VALUE]() {
      return val;
    },
    set [VM_WATCHER_PARENT](v: ParentWatcher) {
      parent = v;
    },
    [VM_WATCHER_NOTIFY]() {
      const newPath = path.map((p) =>
        typeof p === 'object' ? (p[VM_WATCHER_VALUE] as string) : p,
      );
      if (arrayEqual(newPath, innerPath)) {
        return;
      }
      innerPath = newPath;
      const newVal = getValueByPath(target, innerPath);
      if (newVal !== val) {
        val = newVal;
        parent?.[VM_WATCHER_NOTIFY](val);
        renderFn?.(val);
      }
      unwatchFn();
      unwatchFn = __innerW();
    },
  } as ViewWatcher;
  path.forEach((p) => {
    if (typeof p === 'object') {
      p[VM_WATCHER_PARENT] = rtn;
    }
  });
  return rtn;
}

// const w1 = PathWatcher(this, ['c']);
// const w2 = PathWatcher(this, ['d']);
// const w3 = ExprWatcher([w1, w2], (a, b) => a + b);
// const w4 = PathWatcher(this, ['e']);
// const w5 = DymPathWatcher(this, ['a', 'b', w3, w4], true);

// watchForComponent(this, w5, (v) => {
//   setAttribute(el, 'xx', v);
// }, rel);
