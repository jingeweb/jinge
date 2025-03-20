/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CONTEXT,
  ComponentHost,
  ROOT_NODES,
  addMountFn,
  addUnmountFn,
  destroyComponent,
  getFirstDOM,
  handleRenderDone,
  isComponent,
  renderFunctionComponent,
  renderSlotFunction,
} from '../core';
import type { FC, JNode, WithSlots } from '../jsx';
import { type AnyFn, createComment, createFragment, insertBefore, isFunction } from '../util';

export function Lazy<T extends FC>(
  props: (Parameters<T>[0] extends object ? Parameters<T>[0] : {}) & {
    _loader: () => Promise<T>;
  } & WithSlots<{
      loading?: JNode;
      error?: (data: { error: any }) => JNode;
    }>,
  host: ComponentHost,
) {
  const loader = props._loader as () => Promise<T>;
  const errorSlot = props['slot:error'];

  const update = (fc?: AnyFn, error?: any) => {
    if (error) console.error(error);
    if (!fc && !errorSlot) return;

    const oldEl = host[ROOT_NODES][0];
    const isComp = isComponent(oldEl);
    const firstNode = isComp ? getFirstDOM(oldEl) : oldEl;
    const $pa = firstNode.parentNode as Node;
    const el = new ComponentHost(host[CONTEXT]);
    const nodes = fc
      ? renderFunctionComponent(el, fc, props)
      : renderSlotFunction(el, errorSlot, { error });
    insertBefore($pa, nodes.length > 0 ? createFragment(nodes) : nodes[0], firstNode);
    if (isComp) {
      destroyComponent(oldEl);
    } else {
      $pa.removeChild(oldEl);
    }
    host[ROOT_NODES][0] = el;
    handleRenderDone(el);
  };

  let outdated = false;
  addMountFn(host, () => {
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
  addUnmountFn(host, () => {
    outdated = true;
  });

  const loadingSlot = props['slot:loading'];
  if (loadingSlot) {
    const el = new ComponentHost(host[CONTEXT]);
    host[ROOT_NODES].push(el);
    const nodes = renderSlotFunction(el, loadingSlot);
    return nodes;
  } else {
    const cmt = createComment('lazy');
    host[ROOT_NODES].push(cmt);
    return host[ROOT_NODES];
  }
}

// BEGIN_ONLY_PRODUCTION
let dymIncId = 0;
// END_ONLY_PRODUCTION

export function lazy<T extends FC>(
  loader: () => Promise<T>,
  options?: {
    /** 错误发生时渲染的函数组件。组件的 props 中会传递 error 参数。 */
    'slot:error'?: (props: { error: any }) => JNode;
    /** 加载时渲染的函数组件。 */
    'slot:loading'?: JNode;
  },
) {
  const loadingFc = options?.['slot:loading'] as FC;
  const errorFc = options?.['slot:error'] as FC;

  function DymLazy(props: any, host: ComponentHost) {
    props['slot:loading'] = loadingFc
      ? (_: any, host: ComponentHost) => renderFunctionComponent(host, loadingFc)
      : undefined;
    props['slot:error'] = errorFc
      ? (err: any, host: ComponentHost) => renderFunctionComponent(host, errorFc, err)
      : undefined;
    const el = new ComponentHost(host[CONTEXT]);
    if (props === undefined) {
      props = { _loader: loader };
    } else {
      props._loader = loader;
    }
    const nodes = renderFunctionComponent(el, Lazy, props);
    host[ROOT_NODES].push(el);
    return nodes;
  }

  // BEGIN_DROP_IN_PRODUCTION
  const __HMR__ = window.__JINGE_HMR__;
  if (__HMR__) {
    // DymLazy 是动态生成的 Lazy 组件，每一个的 __hmrId__ 都应该是唯一的。
    __HMR__.registerFunctionComponent(DymLazy, `jinge::lazy::${dymIncId++}`);
  }
  // END_DROP_IN_PRODUCTION

  return DymLazy as T;
}
