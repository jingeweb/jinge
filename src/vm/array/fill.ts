import {
  VM_PROXY,
  VM_RAW,
  type ViewModelArray,
  type ViewModelRaw,
  addParent,
  mayBeVm,
  removeParent,
} from '../core';
import { wrapViewModel } from '../proxy';

export function arrayFill(target: ViewModelArray, v: ViewModelRaw) {
  const rawArr = target[VM_RAW];
  const len = rawArr.length;
  if (len === 0) return rawArr[VM_PROXY];

  if (mayBeVm(v)) {
    let viewModel = v[VM_PROXY];
    const rawValue = viewModel ?? v;
    if (!viewModel) viewModel = wrapViewModel(v);
    for (let i = 0; i < len; i++) {
      rawArr[i] = rawValue;
      const oldViewModel = target[i];
      oldViewModel && removeParent(oldViewModel, target, i);
      target[i] = viewModel;
      addParent(viewModel, target, i);
    }
  } else {
    for (let i = 0; i < len; i++) {
      rawArr[i] = v;
      const oldViewModel = target[i];
      oldViewModel && removeParent(oldViewModel, target, i);
      (target as unknown[])[i] = undefined;
    }
  }
  return rawArr[VM_PROXY];
}
