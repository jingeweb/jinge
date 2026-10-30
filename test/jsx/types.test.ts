import type {
  JNode,
  Ref,
  WithChildren,
  WithEvents,
  WithExpose,
  WithOptChildren,
  WithPropSlot,
  WithSlots,
} from '../../src';

// tsc --noEmit checks these contracts; Jest verifies the accompanying valid values.
test('JSX helper types retain event, slot and exposed API contracts', () => {
  const events: WithEvents<{ change(value: number): void }> = {
    'on:change': (value) => {
      expect(value).toBe(1);
    },
  };
  events['on:change'](1);
  const text: WithPropSlot<'title', JNode> = { title: 'Title' };
  const slot: WithPropSlot<'title', JNode> = { 'slot:title': 'Slot' };
  const children: WithChildren<string> = { children: 'body' };
  const optional: WithOptChildren<string> = {};
  const slots: WithSlots<{ default: string; icon?: JNode }> = {
    children: 'body',
    'slot:icon': 'icon',
  };
  const exposed: WithExpose<{ focus(): void }> = { ref: { value: { focus: () => {} } } };
  const ref: Ref<HTMLInputElement> = { value: document.createElement('input') };
  expect([
    text.title,
    slot['slot:title'],
    children.children,
    slots.children,
    optional.children,
  ]).toEqual(['Title', 'Slot', 'body', 'body', undefined]);
  expect(exposed.ref?.value).toEqual({ focus: expect.any(Function) });
  expect(ref.value?.tagName).toBe('INPUT');
  // @ts-expect-error title text and title slot are mutually exclusive.
  const both: WithPropSlot<'title', JNode> = { title: 'x', 'slot:title': 'y' };
  // @ts-expect-error event keys must carry the on: prefix.
  const wrongEvent: WithEvents<{ change(value: number): void }> = { change: () => {} };
  // @ts-expect-error required default slots require children.
  const missing: WithSlots<{ default: string }> = {};
  // @ts-expect-error exposed API must match the declared signature.
  const wrongRef: WithExpose<{ focus(): void }> = { ref: { value: { focus: 1 } } };
  void both;
  void wrongEvent;
  void missing;
  void wrongRef;
});
