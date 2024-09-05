import {
  VM_PROXY,
  VM_RAW,
  type ViewModel,
  type ViewModelArray,
  addParent,
  mayBeVm,
  removeParent,
} from '../core';
import { wrapObj } from '../proxy';
import { notifyVmArrayChange } from '../watch';

export function arrayUnshift(target: ViewModelArray, ...args: ViewModel[]) {
  const rawArr = target[VM_RAW];
  const argsLen = args.length;
  if (argsLen === 0) return rawArr.length;

  let hasVm = target.length > 0;
  hasVm &&
    target.forEach((v, i) => {
      if (v) {
        removeParent(v, target, i);
        addParent(v, target, i + args.length);
      }
    });
  args.forEach((arg, i) => {
    if (mayBeVm(arg)) {
      let viewModel = arg[VM_PROXY];
      if (viewModel) {
        rawArr.unshift(viewModel[VM_RAW]);
      } else {
        viewModel = wrapObj(arg);
        rawArr.unshift(arg);
      }
      target.unshift(viewModel);
      hasVm = true;
      addParent(viewModel, target, argsLen - i - 1);
    } else {
      rawArr.unshift(arg);
      if (hasVm) {
        (target as unknown[]).unshift(undefined);
      }
    }
  });

  notifyVmArrayChange(target);
  return rawArr.length;
}
