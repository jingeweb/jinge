import type { Component } from './component';

export enum ComponentState {
  INITIALIZE = 0,
  RENDERED = 1,
  WILLDESTROY = 2,
  DESTROIED = 3,
}
export enum ContextStates {
  UNTOUCH = 0,
  TOUCHED = 1,
  UNTOUCH_FREEZED = 2,
  TOUCHED_FREEZED = 3,
}

export type RenderFn<T extends Component = Component> = (containerComponent: T) => Node[];

export const EMITTER = Symbol('EMITTER');
export const __ = Symbol('__');
export const ROOT_NODES = Symbol('ROOT_NODES');
export const NON_ROOT_COMPONENT_NODES = Symbol('NON_ROOT_COMPONENT_NODES');
export const SLOTS = Symbol('SLOTS');
export const REFS = Symbol('REFS');
export const CONTEXT = Symbol('CONTEXT');
export const DEREGISTER_FUNCTIONS = Symbol('DEREGISTER_FUNCTIONS');
export const STATE = Symbol('STATE');
export const PASSED_ATTRIBUTES = Symbol('PASSED_ATTRIBUTES');
export const WATCH = Symbol('WATCH');
export const CONTEXT_STATE = Symbol('CONTEXT_STATE');
export const UPDATE_NEXT_MAP = Symbol('UPDATE_NEXT_MAP');
export const RELATED_REFS = Symbol('RELATED_REFS');
export const RELATED_REFS_ORIGIN = Symbol('ORIGIN');
export const RELATED_REFS_KEY = Symbol('KEY');
export const RELATED_REFS_NODE = Symbol('NODE');
export const RELATED_WATCH = Symbol('RELATED_WATCH');
export const SET_REF = Symbol('SET_REF');
export const DESTROY = Symbol('DESTROY');
export const DESTROY_CONTENT = Symbol('DESTROY_CONTENT');
export const RENDER_TO_DOM = Symbol('RENDER_TO_DOM');
export const HANDLE_RENDER_DONE = Symbol('HANDLE_RENDER_DONE');
