import {
  addUnmountFn,
  CONTEXT,
  DEFAULT_SLOT,
  destroyComponent,
  newComponentWithDefaultSlot,
  renderSlotFunction,
  ROOT_NODES,
  SLOTS,
  type ComponentHost,
} from '../core';
import type { JNode, PropsWithSlots } from '../jsx';
import { appendChildren, createComment } from '../util';

export interface PortalProps {
  /** portal 的目标元素，默认为 document.body。注意该属性为单向绑定属性。 */
  target?: HTMLElement;
}
export function Portal(this: ComponentHost, props: PropsWithSlots<PortalProps, JNode>) {
  const renderFn = this[SLOTS][DEFAULT_SLOT];
  if (renderFn) {
    const el = newComponentWithDefaultSlot(this[CONTEXT]);
    const nodes = renderSlotFunction(el, renderFn);
    appendChildren(props.target ?? document.body, nodes);
    addUnmountFn(this, () => {
      destroyComponent(el, true);
    });
  }
  this[ROOT_NODES].push(createComment('ported'));
  return this[ROOT_NODES];
}
