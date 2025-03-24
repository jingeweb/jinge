import { createComment } from '../util';
import { ComponentHost, DEFAULT_SLOT_NAME, replaceRenderSlot } from '../core';
import { CONTEXT, ROOT_NODES, addUnmountFn, renderSlotFunction } from '../core';
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
  const el = new ComponentHost(host[CONTEXT]);
  host[ROOT_NODES].push(el);

  const getSlot = (e: boolean) =>
    (e ? props[DEFAULT_SLOT_NAME] : props['slot:else']) as FC | undefined;

  const render = () => {
    const e = !!props.expect;
    const slotFc = getSlot(e);
    if (slotFc) {
      return renderSlotFunction(el, slotFc);
    } else {
      el[ROOT_NODES].push(createComment(`if:${e}`));
      return el[ROOT_NODES];
    }
  };

  const update = (expect: unknown) => {
    const e = !!expect;
    replaceRenderSlot(el, getSlot(e), host[CONTEXT], undefined, `if:${e}`);
  };

  // 注意如果使用 vmWatch 则需要手动调用 addUnmountFn 来注册组件销毁时的取消监听。
  addUnmountFn(host, vmWatch(props, 'expect', update));

  return render();
}
