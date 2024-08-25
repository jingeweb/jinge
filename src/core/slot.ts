import { CONTEXT, DEFAULT_SLOT, SLOTS, type Context, type RenderFn } from './common';
import { Component } from './component';

const VM = Symbol('vm');

export class SlotRenderComponent extends Component {
  [VM]: object;
  constructor(vm: object) {
    super();
    this[VM] = vm;
  }

  render() {
    return this[SLOTS][DEFAULT_SLOT]?.(this, this[VM]) ?? [];
  }
}
/**
 * 给编译器使用的创建包裹 Slot 渲染的组件。比如：
 * ```
 * render() {
 *   return <div>{this.slots.xx({ i: this.i })}</div>
 * }
 * ```
 * 中的 `this.slots.xx` 会被替换为 `newSlotRenderComponent(this[CONTEXT], this[SLOTS].xx)`
 */
export function newSlotRenderComponent(
  vm: object,
  context: Context | undefined,
  renderFn?: RenderFn,
) {
  const c = new SlotRenderComponent(vm);
  c[CONTEXT] = context;
  renderFn && (c[SLOTS][DEFAULT_SLOT] = renderFn);
  return c;
}
