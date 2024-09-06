import {
  CONTEXT,
  type ComponentHost,
  ROOT_NODES,
  SLOTS,
  addMountFn,
  addUnmountFn,
  destroyComponent,
  getFirstDOM,
  handleRenderDone,
  isComponent,
  newComponentWithDefaultSlot,
  newComponentWithSlots,
  renderFunctionComponent,
  renderSlotFunction,
} from '../core';
import type { JNode, PropsWithOptionalSlots } from '../jsx';
import { type AnyFn, createComment, createFragment, insertBefore, isFunction } from '../util';

export function Lazy(
  this: ComponentHost,
  props: PropsWithOptionalSlots<
    {
      loader: () => Promise<AnyFn>;
    },
    {
      loading?: JNode;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error?: (vm: { error: any }) => JNode;
    }
  >,
) {
  const loader = props.loader;
  const errorSlot = this[SLOTS].error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update = (fc?: AnyFn, error?: any) => {
    if (error) console.error(error);
    if (!fc && !errorSlot) return;

    const oldEl = this[ROOT_NODES][0];
    const isComp = isComponent(oldEl);
    const firstNode = isComp ? getFirstDOM(oldEl) : oldEl;
    const $pa = firstNode.parentNode as Node;
    const el = newComponentWithDefaultSlot(this[CONTEXT]);
    const nodes = fc
      ? renderFunctionComponent(el, fc)
      : renderSlotFunction(el, errorSlot, { error });
    insertBefore($pa, nodes.length > 0 ? createFragment(nodes) : nodes[0], firstNode);
    if (isComp) {
      destroyComponent(oldEl);
    } else {
      $pa.removeChild(oldEl);
    }
    this[ROOT_NODES][0] = el;
    handleRenderDone(el);
  };

  let outdated = false;
  addMountFn(this, () => {
    loader().then(
      (fc) => {
        if (outdated) return; // 组件如果已经被销毁（过期），则忽略加载器的返回逻辑。暂未设计成允许 abort 的模式。

        if (!isFunction(fc)) update(undefined, new Error('Lazy 组件的 loader 函数未返回函数组件'));
        else update(fc);
      },
      (err) => {
        if (outdated) return; // 组件如果已经被销毁（过期），则忽略加载器的返回逻辑。暂未设计成允许 abort 的模式。
        update(undefined, err);
      },
    );
  });
  addUnmountFn(this, () => {
    outdated = true;
  });

  const loadingSlot = this[SLOTS].loading;
  if (loadingSlot) {
    const el = newComponentWithDefaultSlot(this[CONTEXT]);
    this[ROOT_NODES].push(el);
    const nodes = renderSlotFunction(el, loadingSlot);
    return nodes;
  } else {
    const cmt = createComment('lazy');
    this[ROOT_NODES].push(cmt);
    return this[ROOT_NODES];
  }
}

// BEGIN_ONLY_PRODUCTION
let dymIncId = 0;
// END_ONLY_PRODUCTION

export function lazy(
  loader: () => Promise<AnyFn>,
  options?: {
    /** 错误发生时渲染的函数组件。组件的 props 中会传递 error 参数。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error?: (props: { error: any }) => any;
    /** 加载时渲染的函数组件。 */
    loading?: AnyFn;
  },
) {
  const loadingFc = options?.loading;
  const errorFc = options?.error;

  function DymLazy(this: ComponentHost) {
    const el = newComponentWithSlots(this[CONTEXT], {
      loading: loadingFc ? (host) => renderFunctionComponent(host, loadingFc) : undefined,
      error: errorFc ? (host, vm) => renderFunctionComponent(host, errorFc, vm) : undefined,
    });
    const nodes = renderFunctionComponent(el, Lazy, { loader });
    this[ROOT_NODES].push(el);
    return nodes;
  }

  // BEGIN_DROP_IN_PRODUCTION
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const __HMR__ = (window as any).__JINGE_HMR__;
  if (__HMR__) {
    // DymLazy 是动态生成的 Lazy 组件，每一个的 __hmrId__ 都应该是唯一的。
    __HMR__.registerFunctionComponent(DymLazy, `jinge::core::DymLazy::${dymIncId++}`);
  }
  // END_DROP_IN_PRODUCTION

  return DymLazy;
}
