import { arrayEqual, clearImmediate, isUndefined, setImmediate } from '../util';
import type { PropertyPathItem, ViewModel } from '../vm';
import { VM_RAW, VM_WATCHER_VALUE, getValueByPath, innerWatchPath } from '../vm';
import { type ComponentHost, addUnmountFn } from './component';

////// 这个文件里的函数都是用于给编译器转译 tsx 时使用的 Component 的 watch 函数。 /////
////// 业务中请直接使用 `watch` 函数进行 Component 或 ViewModel 的监听。        /////

export function watchForRender(
  watcher: Pick<
    ViewWatcher,
    typeof VM_WATCHER_DESTROY | typeof VM_WATCHER_PARENT | typeof VM_WATCHER_VALUE
  >,
  renderFn: (v: unknown) => void,
  hostComponent: ComponentHost,
) {
  watcher[VM_WATCHER_PARENT] = {
    [VM_WATCHER_NOTIFY]: renderFn,
  };
  renderFn(watcher[VM_WATCHER_VALUE]);

  addUnmountFn(hostComponent, () => watcher[VM_WATCHER_DESTROY]());
}

/**
 * 用于最简单的诸如 {this.a.b.c} 这样的纯 path 的表达式的监控。同时也支持附带了简单 `!` 运算符的情况。
 * @param notOp 0 代表不进行 bool 转换，1 代表一次(!运算，例如 `<button disabled={!this.submitting} />`，2代表两次（!!运算，例如 `<button disabled={!!this.submitting} />`)
 */
export function watchPathForRender2(
  target: ViewModel,
  path: PropertyPathItem[],
  renderFn: (v: unknown) => void,
  notOp: number,
  hostComponent: ComponentHost,
) {
  if (!target) {
    renderFn(undefined);
    return;
  }

  const val = getValueByPath(target, path);
  const innerRenderFn =
    notOp === 1
      ? (v: unknown) => renderFn(!v)
      : notOp === 2
        ? (v: unknown) => renderFn(!!v)
        : renderFn;
  innerRenderFn(val);
  if (isUndefined(target[VM_RAW])) {
    return;
  }
  addUnmountFn(hostComponent, innerWatchPath(target, val, innerRenderFn, path, true));
}

/**
 * 用于最简单的诸如 {this.a.b.c} 这样的纯 path 的表达式的监控。
 */
export function watchPathForRender(
  target: ViewModel,
  path: PropertyPathItem[],
  renderFn: (v: unknown) => void,
  hostComponent: ComponentHost,
) {
  watchPathForRender2(target, path, renderFn, 0, hostComponent);
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
  target: ViewModel,
  path: PropertyPathItem[],
  deep = false,
): ViewWatcher {
  let val = getValueByPath(target, path);

  let parent: ParentWatcher | undefined = undefined;
  const unwatchFn = !isUndefined(target[VM_RAW])
    ? innerWatchPath(
        target,
        val,
        (v) => {
          val = v;
          parent?.[VM_WATCHER_NOTIFY](v);
        },
        path,
        deep,
      )
    : undefined;

  return {
    [VM_WATCHER_DESTROY]() {
      parent = undefined;
      unwatchFn?.();
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
  let imm = 0;
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
  target: ViewModel,
  path: (PropertyPathItem | ViewWatcher)[],
  deep?: boolean,
) {
  let innerPath = path.map((p) => (typeof p === 'object' ? (p[VM_WATCHER_VALUE] as string) : p));
  let val = getValueByPath(target, innerPath);
  let parent: ParentWatcher | undefined = undefined;
  const __innerW = () => {
    return innerWatchPath(
      target,
      val,
      (v) => {
        val = v;
        parent?.[VM_WATCHER_NOTIFY](v);
      },
      innerPath,
      deep,
    );
  };
  let unwatchFn = !isUndefined(target[VM_RAW]) ? __innerW() : undefined;
  const rtn = {
    [VM_WATCHER_DESTROY]() {
      parent = undefined;
      unwatchFn?.();
    },
    get [VM_WATCHER_VALUE]() {
      return val;
    },
    set [VM_WATCHER_PARENT](v: ParentWatcher) {
      parent = v;
    },
    [VM_WATCHER_NOTIFY]() {
      if (!unwatchFn) return;
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
