import { isObject } from 'src/util';
import {
  GlobalViewModelWeakMap,
  VM_RAW,
  type ViewModel,
  type ViewModelArray,
  addParent,
  removeParent,
  shouldBeVm,
} from '../core';
import { wrapViewModel } from '../proxy';

export function arrayFill(targetViewModel: ViewModelArray, target: unknown[], v: unknown) {
  const len = target.length;
  if (len === 0) return targetViewModel;

  if (shouldBeVm(v)) {
    let newVm = v[VM_RAW] ? v : GlobalViewModelWeakMap.get(v);
    const newRawV = newVm ? v[VM_RAW] : v;
    if (!newVm) newVm = wrapViewModel(v);
    for (let i = 0; i < len; i++) {
      const val = target[i];
      const valVm = isObject(val)
        ? val[VM_RAW]
          ? (val as ViewModel)
          : GlobalViewModelWeakMap.get(val)
        : undefined;
      valVm && removeParent(valVm, targetViewModel, i);

      target[i] = newRawV;
      addParent(newVm, targetViewModel, i);
    }
  } else {
    for (let i = 0; i < len; i++) {
      const val = target[i];
      const valVm = isObject(val)
        ? val[VM_RAW]
          ? (val as ViewModel)
          : GlobalViewModelWeakMap.get(val)
        : undefined;
      valVm && removeParent(valVm, targetViewModel, i);
      target[i] = v;
    }
  }
  return targetViewModel;
}
