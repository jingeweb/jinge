import {
  type ComponentHost,
  type FC,
  ROOT_NODES,
  KEY_DATA,
  DEFAULT_SLOT_NAME,
  Transition,
  TransitionGroup,
  destroyComponent,
  addUnmountFn,
  vm,
} from '../../src';
import { classnames2tokens, parseCls } from '../../src/components/transition/helper';
import { elementSlot, jestApi, mount, setupRuntimeTests } from '../_helper';
setupRuntimeTests();
test('transition class helpers split whitespace and share active classes by default', () => {
  expect(parseCls('  a\n b ')).toEqual(['a', 'b']);
  expect(parseCls()).toEqual([]);
  expect(
    classnames2tokens({ enterClass: 'in', leaveClass: 'out', enterActiveClass: 'active' }),
  ).toEqual([['in'], ['active'], ['out'], ['active']]);
});
test('Transition enters and leaves with the expected classes and completion callbacks', async () => {
  jestApi.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  const afterEnter = jestApi.fn();
  const afterLeave = jestApi.fn();
  const props = vm({
    isEnter: false,
    enterClass: 'in',
    leaveClass: 'out',
    enterActiveClass: 'active',
    [DEFAULT_SLOT_NAME]: elementSlot(),
    'on:afterEnter': afterEnter,
    'on:afterLeave': afterLeave,
  });
  mount(Transition, props);
  const node = document.querySelector('div')!;
  expect(node.classList.contains('out')).toBe(true);
  props.isEnter = true;
  await jestApi.advanceTimersByTimeAsync(0);
  expect(node.classList.contains('in')).toBe(true);
  expect(node.classList.contains('out')).toBe(false);
  node.dispatchEvent(new Event('transitionend'));
  node.dispatchEvent(new Event('transitionend'));
  expect(afterEnter).toHaveBeenCalledTimes(1);
  props.isEnter = false;
  await jestApi.advanceTimersByTimeAsync(0);
  expect(node.classList.contains('out')).toBe(true);
  node.dispatchEvent(new Event('transitionend'));
  expect(afterLeave).toHaveBeenCalledTimes(1);
});
test('destroyAfterLeave removes content and re-creates it on the next enter', async () => {
  jestApi.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  const props = vm({ isEnter: true, destroyAfterLeave: true, [DEFAULT_SLOT_NAME]: elementSlot() });
  mount(Transition, props);
  const old = document.querySelector('div')!;
  props.isEnter = false;
  await jestApi.advanceTimersByTimeAsync(0);
  old.dispatchEvent(new Event('transitionend'));
  expect(old.isConnected).toBe(false);
  expect(document.body.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
  props.isEnter = true;
  await jestApi.advanceTimersByTimeAsync(20);
  expect(document.querySelector('div')).not.toBe(old);
  expect(document.querySelector('div')).not.toBeNull();
});
test('reversing an unfinished transition emits cancellation callbacks', async () => {
  jestApi.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  const enterCancelled = jestApi.fn();
  const leaveCancelled = jestApi.fn();
  const props = vm({
    isEnter: false,
    [DEFAULT_SLOT_NAME]: elementSlot(),
    'on:enterCancelled': enterCancelled,
    'on:leaveCancelled': leaveCancelled,
  });
  mount(Transition, props);
  props.isEnter = true;
  await jestApi.advanceTimersByTimeAsync(0);
  props.isEnter = false;
  await jestApi.advanceTimersByTimeAsync(0);
  expect(enterCancelled).toHaveBeenCalledTimes(1);
  props.isEnter = true;
  await jestApi.advanceTimersByTimeAsync(0);
  expect(leaveCancelled).toHaveBeenCalledTimes(1);
});
test('appear defers initial enter and unmount cancels its timer', async () => {
  jestApi.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  const enter = jestApi.fn();
  const host = mount(Transition, {
    isEnter: true,
    appear: true,
    [DEFAULT_SLOT_NAME]: elementSlot(),
    'on:beforeEnter': enter,
  });
  destroyComponent(host);
  await jestApi.advanceTimersByTimeAsync(20);
  expect(enter).not.toHaveBeenCalled();
});
test('TransitionGroup retains a removed row until its leave transition completes', async () => {
  jestApi.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  const props = vm({
    loop: [{ id: 1 }, { id: 2 }],
    key: 'id',
    enterClass: 'in',
    leaveClass: 'out',
    [DEFAULT_SLOT_NAME]: (each: { data: { id: number } }, h: ComponentHost) =>
      elementSlot('div', String(each.data.id))(each, h),
  });
  const host = mount(TransitionGroup, props);
  const first = document.querySelector('div')!;
  props.loop.splice(0, 1);
  await jestApi.advanceTimersByTimeAsync(0);
  expect(first.isConnected).toBe(true);
  expect(first.classList.contains('out')).toBe(true);
  first.dispatchEvent(new Event('transitionend'));
  expect(first.isConnected).toBe(false);
  expect(document.body.textContent).toBe('2');
  destroyComponent(host);
  expect(document.body.childNodes).toHaveLength(0);
});

test('appear runs the delayed enter and supplies the rendered element to callbacks', async () => {
  jestApi.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  const enter = jestApi.fn();
  mount(Transition, {
    isEnter: true,
    appear: true,
    enterClass: 'in',
    leaveClass: 'out',
    [DEFAULT_SLOT_NAME]: elementSlot(),
    'on:beforeEnter': enter,
  });
  const node = document.querySelector('div')!;
  expect(node.classList.contains('out')).toBe(true);
  await jestApi.advanceTimersByTimeAsync(10);
  expect(enter).toHaveBeenCalledWith(node);
  expect(node.classList.contains('in')).toBe(true);
});
test('initially hidden destroyAfterLeave content is created only when entering', async () => {
  jestApi.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  const props = vm({ isEnter: false, destroyAfterLeave: true, [DEFAULT_SLOT_NAME]: elementSlot() });
  mount(Transition, props);
  expect(document.body.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
  props.isEnter = true;
  await jestApi.advanceTimersByTimeAsync(10);
  const node = document.querySelector('div')!;
  expect(node).not.toBeNull();
  node.dispatchEvent(new Event('transitionend'));
});
test('Transition and TransitionGroup reject multiple element roots', () => {
  const two: FC = (_, h) => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    h[ROOT_NODES].push(a, b);
    return [a, b];
  };
  expect(() => mount(Transition, { [DEFAULT_SLOT_NAME]: two })).toThrow(
    'one and only one html element',
  );
  expect(() =>
    mount(TransitionGroup, { loop: [1], key: KEY_DATA, [DEFAULT_SLOT_NAME]: two }),
  ).toThrow('one and only one html element');
});
test('TransitionGroup applies appear to initial rows and cancels pending timers on unmount', async () => {
  jestApi.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  const host = mount(TransitionGroup, {
    loop: [1],
    key: KEY_DATA,
    appear: true,
    enterClass: 'in',
    leaveClass: 'out',
    [DEFAULT_SLOT_NAME]: elementSlot(),
  });
  const node = document.querySelector('div')!;
  expect(node.classList.contains('out')).toBe(true);
  await jestApi.advanceTimersByTimeAsync(10);
  expect(node.classList.contains('in')).toBe(true);
  destroyComponent(host);
  expect(node.isConnected).toBe(false);
  const pending = mount(TransitionGroup, {
    loop: [2],
    key: KEY_DATA,
    appear: true,
    [DEFAULT_SLOT_NAME]: elementSlot(),
  });
  destroyComponent(pending);
  await jestApi.advanceTimersByTimeAsync(20);
  expect(document.body.childNodes).toHaveLength(0);
});

test('F04 closing before enter begins destroys the mounted slot without transition callbacks', async () => {
  jestApi.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  const callback = jestApi.fn(),
    unmount = jestApi.fn();
  const slot: FC = (props, host) => {
    addUnmountFn(host, unmount);
    return elementSlot()(props, host);
  };
  const props = vm({
    isEnter: false,
    destroyAfterLeave: true,
    [DEFAULT_SLOT_NAME]: slot,
    'on:beforeEnter': callback,
    'on:afterEnter': callback,
    'on:enterCancelled': callback,
    'on:beforeLeave': callback,
    'on:afterLeave': callback,
    'on:leaveCancelled': callback,
  });
  mount(Transition, props);
  props.isEnter = true;
  await jestApi.advanceTimersByTimeAsync(0);
  const node = document.querySelector('div')!;
  expect(node).not.toBeNull();
  props.isEnter = false;
  await jestApi.advanceTimersByTimeAsync(0);
  expect(node.isConnected).toBe(false);
  expect(document.body.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
  expect(unmount).toHaveBeenCalledTimes(1);
  await jestApi.advanceTimersByTimeAsync(20);
  node.dispatchEvent(new Event('transitionend'));
  expect(callback).not.toHaveBeenCalled();
  expect(document.querySelector('div')).toBeNull();
});
test('F04 an aborted pending enter can reopen and complete a normal enter/leave cycle', async () => {
  jestApi.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  const afterEnter = jestApi.fn(),
    afterLeave = jestApi.fn();
  const props = vm({
    isEnter: false,
    destroyAfterLeave: true,
    [DEFAULT_SLOT_NAME]: elementSlot(),
    'on:afterEnter': afterEnter,
    'on:afterLeave': afterLeave,
  });
  mount(Transition, props);
  props.isEnter = true;
  await jestApi.advanceTimersByTimeAsync(0);
  const old = document.querySelector('div')!;
  props.isEnter = false;
  await jestApi.advanceTimersByTimeAsync(0);
  expect(old.isConnected).toBe(false);
  props.isEnter = true;
  await jestApi.advanceTimersByTimeAsync(20);
  const node = document.querySelector('div')!;
  expect(node).not.toBe(old);
  node.dispatchEvent(new Event('transitionend'));
  expect(afterEnter).toHaveBeenCalledTimes(1);
  props.isEnter = false;
  await jestApi.advanceTimersByTimeAsync(0);
  expect(node.isConnected).toBe(true);
  node.dispatchEvent(new Event('transitionend'));
  expect(node.isConnected).toBe(false);
  expect(afterLeave).toHaveBeenCalledTimes(1);
});
