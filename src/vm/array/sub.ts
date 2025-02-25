import { wrapViewModelArr } from '.';
import { type AnyFn, isObject } from '../../util';
import { GlobalViewModelWeakMap, VM_RAW, type ViewModelArray } from '../core';

export function arrayConcat(target: unknown[], another: unknown[]) {
  return wrapViewModelArr(target.concat((another as ViewModelArray)[VM_RAW] ?? another));
}

export function arraySlice(target: unknown[], start?: number, end?: number) {
  return wrapViewModelArr(target.slice(start, end));
}

function callFn(v: unknown, i: number, fn: AnyFn) {
  return fn(isObject(v) ? (GlobalViewModelWeakMap.get(v) ?? v) : v, i);
}
export function arrayFilter(target: unknown[], fn: AnyFn) {
  return wrapViewModelArr(
    target.filter(function (v, i) {
      return callFn(v, i, fn);
    }),
  );
}
export function arrayMap(target: unknown[], fn: AnyFn) {
  return wrapViewModelArr(
    target.map(function (v, i) {
      return callFn(v, i, fn);
    }),
  );
}
export function arrayForEach(target: unknown[], fn: AnyFn) {
  target.forEach((v, i) => {
    callFn(v, i, fn);
  });
}
export function arraySome(target: unknown[], fn: AnyFn) {
  return target.some((v, i) => {
    return callFn(v, i, fn);
  });
}
export function arrayEvery(target: unknown[], fn: AnyFn) {
  return target.every((v, i) => {
    return callFn(v, i, fn);
  });
}
export function arrayFindIndex(target: unknown[], fn: AnyFn) {
  return target.findIndex((v, i) => {
    return callFn(v, i, fn);
  });
}
export function arrayFindLastIndex(target: unknown[], fn: AnyFn) {
  return target.findLastIndex((v, i) => {
    return callFn(v, i, fn);
  });
}
export function arrayFindLast(target: unknown[], fn: AnyFn) {
  const v = target.findLast((v, i) => {
    return callFn(v, i, fn);
  });
  return isObject(v) ? (GlobalViewModelWeakMap.get(v) ?? v) : v;
}
export function arrayFind(target: unknown[], fn: AnyFn) {
  const v = target.find((v, i) => {
    return callFn(v, i, fn);
  });
  return isObject(v) ? (GlobalViewModelWeakMap.get(v) ?? v) : v;
}
