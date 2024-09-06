import {
  VM_PROXY,
  VM_RAW,
  type ViewModelArray,
  type ViewModelRaw,
  addParent,
  shouldBeVm,
} from '../core';
import { wrapViewModel } from '../proxy';
import { notifyVmArrayChange } from '../watch';

export function arrayPush(target: ViewModelArray, ...args: ViewModelRaw[]): number {
  const rawArr = target[VM_RAW];
  if (args.length === 0) return rawArr.length;
  args.forEach((arg) => {
    if (shouldBeVm(arg)) {
      rawArr.push(arg);
    } else {
      let viewModel = arg[VM_PROXY];
      if (viewModel) {
        rawArr.push(viewModel[VM_RAW]);
      } else {
        viewModel = wrapViewModel(arg);
        rawArr.push(arg);
      }
      target[rawArr.length - 1] = viewModel;
      addParent(viewModel, target, rawArr.length - 1);
    }
  });
  notifyVmArrayChange(target);

  return rawArr.length;
}
