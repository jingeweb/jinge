import {
  CONTEXT,
  type ComponentHost,
  DEFAULT_SLOT,
  ROOT_NODES,
  SLOTS,
  addMountFn,
  addUnmountFn,
  destroyComponent,
  handleRenderDone,
  newComponentWithDefaultSlot,
  renderSlotFunction,
} from '../core';
import type { JNode, Props } from '../jsx';
import { appendChildren, createComment } from '../util';

export interface PortalProps {
  /** portal 的目标元素，默认为 document.body。注意该属性为单向绑定属性。 */
  target?: HTMLElement;
}
export function Portal(
  props: Props<{
    props: PortalProps;
    children: JNode;
    expose: {
      getPortedHost(): ComponentHost;
    };
  }>,
  host: ComponentHost,
) {
  const renderFn = host[SLOTS][DEFAULT_SLOT];
  if (renderFn) {
    const el = newComponentWithDefaultSlot(host[CONTEXT]);
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
