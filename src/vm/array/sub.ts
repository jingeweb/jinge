import { wrapViewModelArr } from '.';
import type { AnyFn } from '../../util';
import { VM_RAW, type ViewModelArray } from '../core';

export function arrayConcat(target: unknown[], another: unknown[]) {
  return wrapViewModelArr(target.concat((another as ViewModelArray)[VM_RAW] ?? another));
}

export function arraySlice(target: unknown[], start?: number, end?: number) {
  return wrapViewModelArr(target.slice(start, end));
}

export function arrayFilter(target: unknown[], fn: AnyFn) {
  return wrapViewModelArr(target.filter(fn));
}
export function arrayMap(target: unknown[], fn: AnyFn) {
  return wrapViewModelArr(target.map(fn));
}
