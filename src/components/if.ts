import { createComment, createFragment } from '../util';
import type { ComponentHost } from '../core';
import {
  CONTEXT,
  DEFAULT_SLOT,
  ROOT_NODES,
  SLOTS,
  addUnmountFn,
  destroyComponentContent,
  getLastDOM,
  handleRenderDone,
  newComponentWithDefaultSlot,
  renderSlotFunction,
} from '../core';
import type { JNode, PropsWithSlots } from '../jsx';
import { vmWatch } from '../vm';

export interface IfAttrs {
  expect: boolean;
}
export function If(
  this: ComponentHost,
  props: PropsWithSlots<
    {
      expect: boolean;
    },
    | JNode
    | {
        true: JNode;
        false: JNode;
      }
  >,
) {
  /**
   * if 组件的实现展示了不使用 hook 范式的高度自由化的组件实现。
   * FunctionComponent 的 this 是 ComponentHost，代表当前组件的实例组件容器，而 FunctionComponent 本身可以理解成该实例组件的 render 函数。
   */

  const render = () => {
    const slots = this[SLOTS];
    const e = !!props.expect;
    const renderFn = slots[e.toString()] ?? (e ? slots[DEFAULT_SLOT] : undefined);
    const roots = this[ROOT_NODES];
    if (renderFn) {
      const el = newComponentWithDefaultSlot(this[CONTEXT]);
      roots.push(el);
      return renderSlotFunction(el, renderFn);
    } else {
      const cmt = createComment(e.toString());
      roots.push(cmt);
      return roots;
    }
  };

  const update = (expect: boolean) => {
    const lastNode = getLastDOM(this);
    const nextSib = lastNode.nextSibling;
    const $parent = lastNode.parentNode as Node;

    destroyComponentContent(this, true);
    const roots = this[ROOT_NODES];
    roots.length = 0;

    const slots = this[SLOTS];

    const renderFn = slots[expect.toString()] ?? (expect ? slots[DEFAULT_SLOT] : undefined);
    if (renderFn) {
      const el = newComponentWithDefaultSlot(this[CONTEXT]);
      roots.push(el);
      const doms = renderSlotFunction(el, renderFn);
      const newNode = doms.length > 1 ? createFragment(doms) : doms[0];
      if (nextSib) {
        $parent.insertBefore(newNode, nextSib);
      } else {
        $parent.appendChild(newNode);
      }
      handleRenderDone(el);
    } else {
      const cmt = createComment(expect.toString());
      roots.push(cmt);
      if (nextSib) {
        $parent.insertBefore(cmt, nextSib);
      } else {
        $parent.appendChild(cmt);
      }
    }
  };

  // 注意如果使用 vmWatch 则需要手动调用 addUnmountFn 来注册组件销毁时的取消监听。
  addUnmountFn(
    this,
    vmWatch(props, 'expect', (v) => update(!!v)),
  );

  return render();
}
