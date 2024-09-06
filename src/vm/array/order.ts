import { type AnyFn, isObject } from '../../util';
import {
  VM_IGNORED,
  VM_PROXY,
  VM_RAW,
  type ViewModelArray,
  type ViewModelRaw,
  addParent,
  isInnerObj,
  removeParent,
} from '../core';
import { wrapViewModel } from '../proxy';
import { notifyVmArrayChange } from '../watch';

function resetArray(rawArr: ViewModelRaw<ViewModelRaw[]>, target: ViewModelArray) {
  rawArr.forEach((v, i) => {
    const oldViewModel = target[i];
    if (oldViewModel) {
      removeParent(oldViewModel, target, i);
      (target as unknown[])[i] = undefined;
    }
    if (!isObject(v)) return;
    let viewModel = v[VM_PROXY];
    if (!viewModel) {
      if (isInnerObj(v) || v[VM_IGNORED]) {
        return;
      }
      viewModel = wrapViewModel(v);
    }
    target[i] = viewModel;
    addParent(viewModel, target, i);
  });
}
export function arrayReverse(target: ViewModelArray) {
  const rawArr = target[VM_RAW];
  const len = rawArr.length;
  if (len <= 1) return rawArr[VM_PROXY];
  rawArr.reverse();
  resetArray(rawArr, target);
  notifyVmArrayChange(target);
  return rawArr[VM_PROXY];
}

export function arraySort(target: ViewModelArray, fn?: AnyFn) {
  const rawArr = target[VM_RAW];
  if (rawArr.length <= 1) return target[VM_PROXY];
  rawArr.sort(fn);
  resetArray(rawArr, target);
  notifyVmArrayChange(target);
  return rawArr[VM_PROXY];
}
