/* eslint-disable @typescript-eslint/no-explicit-any */
import { isUndefined, throwErr } from '../util';
import type { PropertyPathItem, WatchHandler, WatchOptions } from '../vm';
import { vmWatch } from '../vm';
import { CONTEXT } from './common';
import {
  type ComponentHost,
  addMountFn,
  addUnmountFn,
  getFirstDOM,
  getLastDOM,
  setComponentContext,
} from './component';

const MISS_KEY = 'hook-miss-component';
let componentHost: ComponentHost | undefined = undefined;

export function setCurrentComponentHost(component: ComponentHost | undefined) {
  componentHost = component;
}
export function getCurrentComponentHost() {
  if (!componentHost) throwErr(MISS_KEY);
  return componentHost;
}

/** 监听 vm 对象的 property 属性的变更。 */
export function watch<T extends object, P extends keyof T>(
  vm: T,
  property: P,
  handler: WatchHandler<T[P]>,
  options?: WatchOptions,
): void;
/** 深度监听 vm 对象的任何变更 */
export function watch<T extends object>(
  vm: T,
  handler: WatchHandler<T>,
  options?: {
    /** 是否立即执行监听回调函数，默认 false。 */
    immediate?: boolean;
  },
): void;
/** 监听 vm 对象上的 property path 属性，即多层的子对象的属性。 */
export function watch<T extends object>(
  vm: T,
  propertyPath: PropertyPathItem[],
  handler: WatchHandler<any>,
  options?: WatchOptions,
): void;
export function watch(vm: any, propOrPathOrHanlder: any, handlerOrOptions?: any, options?: any) {
  if (!componentHost) throwErr(MISS_KEY);
  addUnmountFn(componentHost, vmWatch(vm, propOrPathOrHanlder, handlerOrOptions, options));
}

export function onMount(fn: () => (() => void) | void) {
  if (!componentHost) throwErr(MISS_KEY);
  addMountFn(componentHost, fn);
}

export function onUnmount(fn: () => void) {
  if (!componentHost) throwErr(MISS_KEY);
  addUnmountFn(componentHost, fn);
}

export function context<T>(key: string | symbol, value: T): void;
export function context<T>(key: string | symbol): T;
export function context(key: string | symbol, value?: any) {
  if (!componentHost) throwErr(MISS_KEY);
  if (isUndefined(value)) {
    return componentHost[CONTEXT]?.[key];
  } else {
    setComponentContext(componentHost, key, value);
    return;
  }
}

export function exportInstance<E extends {}>(instance: E) {
  if (!componentHost) throwErr(MISS_KEY);
  Object.assign(componentHost, instance);
}

export function firstDOM() {
  if (!componentHost) throwErr(MISS_KEY);
  return getFirstDOM(componentHost);
}

export function lastDOM() {
  if (!componentHost) throwErr(MISS_KEY);
  return getLastDOM(componentHost);
}
