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

export const EMITTER = Symbol();
export const __ = Symbol('__');