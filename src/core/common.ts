import type { ComponentHost } from './component';

export const COMPONENT_STATE_INITIALIZE = 0;
export const COMPONENT_STATE_RENDERED = 1;
export const COMPONENT_STATE_WILLDESTROY = 2;
export const COMPONENT_STATE_DESTROIED = 3;
export type ComponentState = 0 | 1 | 2 | 3;

export const CONTEXT_STATE_UNTOUCH = 0;
export const CONTEXT_STATE_TOUCHED = 1;
export const CONTEXT_STATE_UNTOUCH_FREEZED = 2;
export const CONTEXT_STATE_TOUCHED_FREEZED = 3;
export type ContextState = 0 | 1 | 2 | 3;

export type Context = Record<string | number | symbol, unknown>;

export type RenderFn<T extends ComponentHost = ComponentHost> = (
  containerComponent: T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => Node[];
export interface Slots {
  [DEFAULT_SLOT]?: RenderFn;
  [slotName: string]: RenderFn | undefined;
}

export const __ = Symbol('__');
export const ROOT_NODES = Symbol('ROOT_NODES');
export const NON_ROOT_COMPONENT_NODES = Symbol('NON_ROOT_COMPONENT_NODES');
export const SLOTS = Symbol('SLOTS');
export const DEFAULT_SLOT = Symbol('DEFAULT_SLOT');
export const REFS = Symbol('REFS');
export const CONTEXT = Symbol('CONTEXT');
export const ONMOUNT = Symbol('ON_MOUNT');
export const UNMOUNT_FNS = Symbol('UNMOUNT_FNS');
export const STATE = Symbol('STATE');
export const CONTEXT_STATE = Symbol('CONTEXT_STATE');
