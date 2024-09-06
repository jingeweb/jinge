import {
  GlobalViewModelWeakMap,
  VM_RAW,
  type ViewModelArray,
  addParent,
  shouldBeVm,
} from '../core';
import { wrapViewModel } from '../proxy';
import { notifyVmArrayChange } from '../watch';

export function arrayPush(
  targetViewModel: ViewModelArray,
  target: unknown[],
  ...args: unknown[]
): number {
  if (args.length === 0) return target.length;
  args.forEach((arg) => {
    if (shouldBeVm(arg)) {
      let viewModel = arg[VM_RAW] ? arg : GlobalViewModelWeakMap.get(arg);
      if (viewModel) {
        target.push(viewModel[VM_RAW]);
      } else {
        viewModel = wrapViewModel(arg);
        target.push(arg);
      }
      addParent(viewModel, targetViewModel, target.length - 1);
    } else {
      target.push(arg);
    }
  });
  notifyVmArrayChange(targetViewModel);
  return target.length;
}
