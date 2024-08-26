import type { Component } from './component';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RenderFn<T extends Component<any, any> = Component<any, any>> = (
  containerComponent: T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => Node[];
export interface Slots {
  [DEFAULT_SLOT]?: RenderFn;
  [slotName: string]: RenderFn;
}

export const EMITTER = Symbol('EMITTER');
export const __ = Symbol('__');
export const ROOT_NODES = Symbol('ROOT_NODES');
export const NON_ROOT_COMPONENT_NODES = Symbol('NON_ROOT_COMPONENT_NODES');
export const SLOTS = Symbol('SLOTS');
export const DEFAULT_SLOT = Symbol('DEFAULT_SLOT');
export const REFS = Symbol('REFS');
export const CONTEXT = Symbol('CONTEXT');
export const UNMOUNT_FNS = Symbol('UNMOUNT_FNS');
export const STATE = Symbol('STATE');
export const CONTEXT_STATE = Symbol('CONTEXT_STATE');
// export const UPDATE_NEXT_MAP = Symbol('UPDATE_NEXT_MAP');
// export const RELATED_REFS = Symbol('RELATED_REFS');
// export const RELATED_REFS_ORIGIN = Symbol('ORIGIN');
// export const RELATED_REFS_KEY = Symbol('KEY');
// export const RELATED_REFS_NODE = Symbol('NODE');
export const HOST_UNWATCH = Symbol('HOST_UNWATCH');
export const UPDATE_RENDER = Symbol('UPDATE_RENDER');
