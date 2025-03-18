import type { ComponentHost } from '../../core';
import {
  CONTEXT,
  DEFAULT_SLOT,
  ROOT_NODES,
  SLOTS,
  addUnmountFn,
  destroyComponent,
  handleRenderDone,
  newComponentWithDefaultSlot,
  renderSlotFunction,
} from '../../core';
import type { JNode, Props } from '../../jsx';
import {
  addEvent,
  createComment,
  createFragment,
  insertBefore,
  removeEvent,
  throwErr,
} from '../../util';
import { vmWatch } from '../../vm';
import { TRANSITION_END, classnames2tokens } from './helper';

export interface TransitionClassnames {
  /** enter 的目标 html class。默认为空。该属性为单向属性。*/
  enterClass?: string;
  /** leave 的目标 html class。默认为空。该属性为单向属性。 */
  leaveClass?: string;
  /** enter 开始后的激发 html class。默认和 leaveActiveClass 一致（二者都没配置则为空）。该属性为单向属性。 */
  enterActiveClass?: string;
  /** leave 开始后的激发 html class。默认和 enterActiveClass 一致（二者都没配置则为空）。该属性为单向属性。 */
  leaveActiveClass?: string;
}

export interface TransitionInnerProps {
  /** 当动画 leave 完成后，是否销毁渲染内容。默认为 false。该属性为单向属性。 */
  destroyAfterLeave?: boolean;
  /** 控制 transiton 的状态是 enter 还是 leave 状态。切换状态可触发 transition 动画。 */
  isEnter?: boolean;
  /** 是否在首次渲染时应用动画。默认为 false。该属性为单向属性。 */
  appear?: boolean;
}

export type TransitionProps = TransitionInnerProps & TransitionClassnames;

const TStateEntering = 0;
const TStateEntered = 1;
const TStateLeaving = 2;
const TStateLeaved = 3;

export function Transition(
  props: Props<{
    props: TransitionProps;
    children: JNode;
    events: {
      beforeEnter?(el?: Element): void;
      afterEnter?(el?: Element): void;
      enterCancelled?(el?: Element): void;
      beforeLeave?(el?: Element): void;
      afterLeave?(el?: Element): void;
      leaveCancelled?(el?: Element): void;
    };
  }>,
  host: ComponentHost,
) {
  const destroyAfterLeave = !!props.destroyAfterLeave;
  let realEnter = props.appear ? !props.isEnter : !!props.isEnter;
  let rootEl: Element | undefined = undefined;
  let state = realEnter ? TStateEntered : TStateLeaved;
  let tm = 0;

  // 提前将四种状态的 class 字符串转成 Element.classList 支持的 tokens
  const classTokens = classnames2tokens(props);
  const toggleClass = () => {
    if (!rootEl) return;
    const clist = rootEl.classList;
    const ir = realEnter ? 2 : 0;
    const ia = realEnter ? 0 : 2;
    clist.remove(...classTokens[ir], ...classTokens[ir + 1]);
    clist.add(...classTokens[ia], ...classTokens[ia + 1]);
    realEnter ? props['on:beforeEnter']?.(rootEl) : props['on:beforeLeave']?.(rootEl);
  };

  const destroyMount = () => {
    if (!rootEl) return;
    const roots = host[ROOT_NODES];
    const el = roots[0] as ComponentHost;
    const cmt = createComment('leaved');
    insertBefore(rootEl.parentNode!, cmt, rootEl);
    destroyComponent(el);
    rootEl = undefined; // rootEl 是 el 组件的渲染元素，销毁 el 组件时 rootEl 也会被移除，不需要主动处理。
    roots[0] = cmt;
  };

  const onTransEnd = () => {
    if (state === TStateEntering) {
      state = TStateEntered;
      props['on:afterEnter']?.(rootEl);
    } else if (state === TStateLeaving) {
      state = TStateLeaved;
      props['on:afterLeave']?.(rootEl);
      if (destroyAfterLeave) {
        destroyMount();
      }
    } else {
      // transition end 可能在多个 property 动画结束时都触发。忽略除第一个之外的其它 propery 的事件。
    }
  };

  const renderMount = () => {
    const el = newComponentWithDefaultSlot(host[CONTEXT]);
    const nodes = renderSlotFunction(el, host[SLOTS][DEFAULT_SLOT]);
    if (nodes.length > 1 || !(nodes[0] instanceof Element)) {
      throwErr('transition-require-element');
    }
    if (rootEl) {
      removeEvent(rootEl, TRANSITION_END, onTransEnd);
    }
    rootEl = nodes[0];
    rootEl.classList.add(...(realEnter ? classTokens[0] : classTokens[2]));
    addEvent(rootEl, TRANSITION_END, onTransEnd);
    return { el, nodes };
  };

  const updateMount = () => {
    const cmt = host[ROOT_NODES][0] as Node;
    const { el, nodes } = renderMount();
    host[ROOT_NODES][0] = el;
    const pa = cmt.parentNode as Node;
    insertBefore(pa, nodes.length > 0 ? createFragment(nodes) : nodes[0], cmt);
    pa.removeChild(cmt);
    handleRenderDone(el);
    tm = window.setTimeout(() => {
      // mount 元素渲染之后，进入 entering，触发动画。
      state = TStateEntering;
      realEnter = true;
      toggleClass();
    }, 10);
  };

  const handleUpdate = (isEnter: boolean) => {
    if (tm) {
      clearTimeout(tm);
      tm = 0;
    }
    if (isEnter) {
      // isEnter === true，说明之前的 isEnter 一定是 false，则 state 只可能是 Leaving 或 Leaved 状态。
      if (state === TStateLeaving) {
        props['on:leaveCancelled']?.(rootEl);
        state = TStateEntering;
        realEnter = true;
        // 状态是 Leaving，则一定有 mount 元素 ，直接触发动画。
        toggleClass();
      } else {
        if (destroyAfterLeave) {
          // 状态是 Leaved，并且 destroyAfterLeave 是 true，则说明还未 mount 元素 ，先 mount 后再触发动画。
          updateMount();
        } else {
          state = TStateEntering;
          realEnter = true;
          // 否则直接触发动画
          toggleClass();
        }
      }
    } else {
      // isEnter === true，说明之前的 isEnter 一定是 false，则 state 只可能是 Entering 或 Entered 状态。
      if (state === TStateEntering || state === TStateEntered) {
        if (state === TStateEntering) {
          props['on:enterCancelled']?.(rootEl);
        }
        state = TStateLeaving;
        realEnter = false;
        // 不论是 Entering 还是 Entered 状态，都一定有 mount 元素，直接触发动画。
        toggleClass();
      }
    }
  };

  vmWatch(props, 'isEnter', (v) => {
    handleUpdate(!!v);
  });

  addUnmountFn(host, () => {
    if (rootEl) removeEvent(rootEl, TRANSITION_END, onTransEnd);
    if (tm) clearTimeout(tm);
  });

  if (props.appear) {
    tm = window.setTimeout(() => {
      handleUpdate(!realEnter);
    }, 10);
  }

  if (destroyAfterLeave && !realEnter) {
    host[ROOT_NODES].push(createComment('leaved'));
    return host[ROOT_NODES];
  } else {
    const { el, nodes } = renderMount();
    host[ROOT_NODES].push(el);
    return nodes;
  }
}
