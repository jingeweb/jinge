import {
  expose,
  ref as createRef,
  type BootstrapReturn,
  type ForSlot,
  type JNode,
  type Ref,
  type RefFn,
  type RefValue,
  type WithChildren,
  type WithEvents,
  type WithExpose,
  type WithOptChildren,
  type WithPropSlot,
  type WithSlots,
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
  const exposedRef: Ref<{ focus(): void }> = { value: { focus: () => {} } };
  const exposed: WithExpose<{ focus(): void }> = { ref: exposedRef };
  const ref: Ref<HTMLInputElement> = { value: document.createElement('input') };
  expect([
    text.title,
    slot['slot:title'],
    children.children,
    slots.children,
    optional.children,
  ]).toEqual(['Title', 'Slot', 'body', 'body', undefined]);
  expect(exposed.ref).toBe(exposedRef);
  expect(exposedRef.value).toEqual({ focus: expect.any(Function) });
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

test('F06 inert accepts boolean HTML props and F11 For slots expose only data/index', () => {
  const html: JSX.IntrinsicElements['div'][] = [
    { inert: true },
    { inert: false },
    { inert: undefined },
  ];
  expect(html.map((props) => props.inert)).toEqual([true, false, undefined]);
  // @ts-expect-error inert is a boolean attribute, not a string attribute.
  const invalid: JSX.IntrinsicElements['div'] = { inert: 'false' };
  const each: Parameters<ForSlot<string>>[0] = { data: 'item', index: 0 };
  expect(each).toEqual({ data: 'item', index: 0 });
  // @ts-expect-error boundaries are calculated by business code using the index.
  void each.isFirst;
  // @ts-expect-error For does not supply isLast at runtime.
  void each.isLast;
  void invalid;
});

test('F10 callback refs infer the handle and require unmount handling', () => {
  type Handle = { answer(): number };
  function Child(props: WithExpose<Handle>) {
    void props;
    expose<typeof Child>({ answer: () => 42 });
    return null;
  }
  const value: RefValue<WithExpose<Handle>['ref']> = { answer: () => 42 };
  const objectRef = createRef<typeof Child>();
  objectRef.value = value;
  expect(objectRef.value.answer()).toBe(42);
  // @ts-expect-error component ref inference must retain the exposed API.
  void objectRef.value.missing;
  const received: (number | undefined)[] = [];
  const props: WithExpose<Handle> = {
    ref: (handle) => {
      received.push(handle?.answer());
      // @ts-expect-error the callback receives undefined when its owner unmounts.
      const mounted: Handle = handle;
      void mounted;
    },
  };
  if (typeof props.ref === 'function') {
    props.ref(value);
    props.ref(undefined);
  }
  expect(received).toEqual([42, undefined]);
  // @ts-expect-error callback refs must accept the unmount value.
  const unsafe: RefFn<Handle> = (handle: Handle) => {
    void handle;
  };
  // @ts-expect-error expose inference must reject an invalid method.
  const invalid: Parameters<typeof expose<typeof Child>>[0] = { answer: 42 };
  const callbackValue: RefValue<RefFn<Handle>> = value;
  function CallbackOnly(props: { ref?: RefFn<Handle> }) {
    void props;
    expose<typeof CallbackOnly>({ answer: () => 42 });
    return null;
  }
  const callbackRef = createRef<typeof CallbackOnly>();
  callbackRef.value = callbackValue;
  expect(callbackRef.value.answer()).toBe(42);
  const bootstrapped: Pick<BootstrapReturn<typeof CallbackOnly>, 'answer'> = callbackValue;
  expect(bootstrapped.answer()).toBe(42);
  const native: JSX.IntrinsicElements['input'] = { ref: (input) => input?.focus() };
  expect(callbackValue.answer()).toBe(42);
  void unsafe;
  void invalid;
  void native;
});
