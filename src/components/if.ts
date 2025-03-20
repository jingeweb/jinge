import { createComment, createFragment, insertAfter, insertBefore } from '../util';
import { ComponentHost, DEFAULT_SLOT_NAME } from '../core';
import {
  CONTEXT,
  ROOT_NODES,
  addUnmountFn,
  destroyComponentContent,
  getLastDOM,
  handleRenderDone,
  renderSlotFunction,
} from '../core';
import type { FC, JNode, WithSlots } from '../jsx';
import { vmWatch } from '../vm';

export interface IfAttrs {
  expect: boolean;
}
export function If(
  props: {
    expect: boolean;
  } & WithSlots<{
    default?: JNode;
    else?: JNode;
  }>,
  host: ComponentHost,
) {
  /**
   * if 组件的实现展示了不使用 hook 范式的高度自由化的组件实现。
   * FunctionComponent 的 this 是 ComponentHost，代表当前组件的实例组件容器，而 FunctionComponent 本身可以理解成该实例组件的 render 函数。
   */

  const render = () => {
    const e = !!props.expect;
    const renderFn = e ? (props[DEFAULT_SLOT_NAME] as FC) : (props['slot:else'] as FC);
    const roots = host[ROOT_NODES];
    if (renderFn) {
      const el = new ComponentHost(host[CONTEXT]);
      roots.push(el);
      return renderSlotFunction(el, renderFn);
    } else {
      const cmt = createComment(e.toString());
      roots.push(cmt);
      return roots;
    }
  };

  const update = (expect: boolean) => {
    const lastNode = getLastDOM(host);
    const $parent = lastNode.parentNode as Node;
    const placeholder = createComment(expect.toString());
    insertAfter($parent, placeholder, lastNode);

    destroyComponentContent(host);
    const roots = host[ROOT_NODES];
    roots.length = 0;

    const renderFn = expect ? (props[DEFAULT_SLOT_NAME] as FC) : (props['slot:else'] as FC);
    if (renderFn) {
      const el = new ComponentHost(host[CONTEXT]);
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
    host,
    vmWatch(props, 'expect', (v) => update(!!v)),
  );

  return render();
}
