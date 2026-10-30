import {
  type ComponentHost as Host,
  type Context,
  type FC,
  ComponentHost,
  ROOT_NODES,
  destroyComponent,
  handleRenderDone,
  renderFunctionComponent,
} from '../src';
import { setCurrentComponentHost } from '../src/core/hook';
import { mockOffscreenCanvas } from './vm/_helper';

export const jestApi = (import.meta as ImportMeta & { jest: typeof jest }).jest;
const hosts = new Set<Host>();
const cleanups: (() => void)[] = [];
export function cleanupWith(fn: () => void) {
  cleanups.push(fn);
  return fn;
}
export function trackHost<T extends Host>(host: T) {
  hosts.add(host);
  return host;
}
export function createHost(context?: Context) {
  return trackHost(new ComponentHost(context));
}
export function flushUpdates() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}
export function mount(
  fc: FC,
  props: object = {},
  parent: HTMLElement = document.body,
  context?: Context,
) {
  const host = createHost(context);
  parent.append(...renderFunctionComponent(host, fc, props));
  handleRenderDone(host);
  return host;
}
export function elementSlot(tag = 'div', text = 'content'): FC {
  return (_, host) => {
    const node = document.createElement(tag);
    node.textContent = text;
    host[ROOT_NODES].push(node);
    return [node];
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
export function setupRuntimeTests() {
  beforeEach(() => {
    mockOffscreenCanvas();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    try {
      cleanups
        .splice(0)
        .reverse()
        .forEach((fn) => fn());
      hosts.forEach((host) => destroyComponent(host, false));
    } finally {
      hosts.clear();
      setCurrentComponentHost(undefined);
      document.body.innerHTML = '';
      delete window.__JINGE_HMR__;
      jestApi.restoreAllMocks();
      jestApi.useRealTimers();
    }
  });
}
