import {
  GlobalViewModelWeakMap,
  VM_RAW,
  type ViewModelArray,
  addParent,
  shouldBeVm,
} from '../core';
import { wrapViewModel } from '../proxy';
import { notifyVmArrayChange } from '../watch';
import { removeArrayItemVmParent } from './helper';

export function arrayUnshift(
  targetViewModel: ViewModelArray,
  target: unknown[],
  ...args: unknown[]
) {
  const argsLen = args.length;
  if (argsLen === 0) return target.length;

  target.forEach((v, i) => {
    const vm = removeArrayItemVmParent(v, targetViewModel, i);
    vm && addParent(vm, targetViewModel, i + args.length);
  });
  for (let i = argsLen - 1; i >= 0; i--) {
    const arg = args[i];
    if (shouldBeVm(arg)) {
      let viewModel = arg[VM_RAW] ? arg : GlobalViewModelWeakMap.get(arg);
      if (viewModel) {
        target.unshift(viewModel[VM_RAW]);
      } else {
        viewModel = wrapViewModel(arg);
        target.unshift(arg);
      }
      addParent(viewModel, targetViewModel, i);
    } else {
      target.unshift(arg);
    }
  }

  notifyVmArrayChange(targetViewModel);
  return target.length;
}
