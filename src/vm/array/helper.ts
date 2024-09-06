import { GlobalViewModelWeakMap, VM_RAW, type ViewModel, removeParent } from '../core';
import { isObject } from 'src/util';

export function removeArrayItemVmParent(val: unknown, targetViewModel: ViewModel, index: number) {
  const valVm = isObject(val)
    ? val[VM_RAW]
      ? (val as ViewModel)
      : GlobalViewModelWeakMap.get(val)
    : undefined;
  valVm && removeParent(valVm, targetViewModel, index);
  return valVm;
}
