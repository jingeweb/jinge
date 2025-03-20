import {
  CONTEXT,
  ComponentHost,
  DEFAULT_SLOT_NAME,
  ROOT_NODES,
  addMountFn,
  addUnmountFn,
  destroyComponent,
  handleRenderDone,
  renderSlotFunction,
} from '../core';
import type { FC, JNode, WithChildren } from '../jsx';
import { appendChildren, createComment } from '../util';

export function Portal(
  props: {
    /** portal 的目标元素，默认为 document.body。注意该属性为单向绑定属性。 */
    target?: HTMLElement;
  } & WithChildren<JNode>,
  host: ComponentHost,
) {
  const renderFn = props[DEFAULT_SLOT_NAME] as FC;
  if (renderFn) {
    const el = new ComponentHost(host[CONTEXT]);
    const nodes = renderSlotFunction(el, renderFn);
    appendChildren(props?.target ?? document.body, nodes);
    addMountFn(host, () => {
      handleRenderDone(el);
    });
    addUnmountFn(host, () => {
      destroyComponent(el, true);
    });
    // 把 getPortedHost 暴露出去，业务侧通过 ref 拿到 Portal 的引用后，
    // 可调用该函数拿到实际被 ported 之后的 ComponentHost，
    // 从而可以进一步通过 getFirstDOM，ROOT_NODES 等进行底层的高级操作。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (host as any).getPortedHost = () => el;
  }
  host[ROOT_NODES].push(createComment('ported'));
  return host[ROOT_NODES];
}
