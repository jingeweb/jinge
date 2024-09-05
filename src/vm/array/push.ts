import {
  VM_PROXY,
  VM_RAW,
  type ViewModelArray,
  type ViewModelRaw,
  addParent,
  mayBeVm,
} from '../core';
import { wrapObj } from '../proxy';
import { notifyVmArrayChange } from '../watch';

export function arrayPush(target: ViewModelArray, ...args: ViewModelRaw[]): number {
  const rawArr = target[VM_RAW];
  if (args.length === 0) return rawArr.length;
  args.forEach((arg) => {
    if (mayBeVm(arg)) {
      rawArr.push(arg);
    } else {
      let viewModel = arg[VM_PROXY];
      if (viewModel) {
        rawArr.push(viewModel[VM_RAW]);
      } else {
        viewModel = wrapObj(arg);
        rawArr.push(arg);
      }
      target[rawArr.length - 1] = viewModel;
      addParent(viewModel, target, rawArr.length - 1);
    }
  });
  notifyVmArrayChange(target);

  return rawArr.length;
}
