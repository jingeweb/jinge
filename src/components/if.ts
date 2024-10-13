import { createComment, createFragment, insertAfter, insertBefore } from '../util';
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
import type { JNode, Props } from '../jsx';
import { vmWatch } from '../vm';

export interface IfAttrs {
  expect: boolean;
}
export function If(
  this: ComponentHost,
  props: Props<{
    props: {
      expect: boolean;
    };
    children:
      | JNode
      | {
          true: JNode;
          false: JNode;
        };
  }>,
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
    const $parent = lastNode.parentNode as Node;
    const placeholder = createComment(expect.toString());
    insertAfter($parent, placeholder, lastNode);

    destroyComponentContent(this);
    const roots = this[ROOT_NODES];
    roots.length = 0;

    const slots = this[SLOTS];

    const renderFn = slots[expect.toString()] ?? (expect ? slots[DEFAULT_SLOT] : undefined);
    if (renderFn) {
      const el = newComponentWithDefaultSlot(this[CONTEXT]);
      roots.push(el);
      const doms = renderSlotFunction(el, renderFn);
      insertBefore($parent, doms.length > 1 ? createFragment(doms) : doms[0], placeholder);
      // 为了让渲染后的 dom 尽可能简洁，如果 slot 不为空，则删除掉占位注释，因为后续能从 slot 取到 dom。
      $parent.removeChild(placeholder);
      handleRenderDone(el);
    } else {
      roots.push(placeholder);
    }
  };

  // 注意如果使用 vmWatch 则需要手动调用 addUnmountFn 来注册组件销毁时的取消监听。
  addUnmountFn(
    this,
    vmWatch(props, 'expect', (v) => update(!!v)),
  );

  return render();
}
