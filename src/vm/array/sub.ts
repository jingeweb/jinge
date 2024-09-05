/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnyFn } from '../../util';
import { VM_RAW, type ViewModelArray } from '../core';
import { wrapArray } from './helper';

export function arrayConcat(target: ViewModelArray, another: ViewModelArray) {
  return wrapArray(target[VM_RAW].concat(another[VM_RAW] ?? another) as any);
}

export function arraySlice(target: ViewModelArray, start?: number, end?: number) {
  return wrapArray(target[VM_RAW].slice(start, end) as any);
}

export function arrayFilter(target: ViewModelArray, fn: AnyFn) {
  return wrapArray(target[VM_RAW].filter(fn) as any);
}
export function arrayMap(target: ViewModelArray, fn: AnyFn) {
  return wrapArray(target[VM_RAW].map(fn) as any);
}
