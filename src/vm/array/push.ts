import { type ViewModelArray, addParent, shouldBeVm } from '../core';
import { getVmAndRaw } from '../object';
import { wrapViewModel } from '../proxy';
import { notifyVmArrayChange } from '../watch';

export function arrayPush(
  targetViewModel: ViewModelArray,
  target: unknown[],
  ...args: unknown[]
): number {
  const len = target.length;
  if (args.length === 0) return len;
  args.forEach((arg, i) => {
    const [valVm, rawVal] = getVmAndRaw(arg);
    if (valVm) {
      addParent(valVm, targetViewModel, len + i);
    } else if (shouldBeVm(arg)) {
      addParent(wrapViewModel(arg), targetViewModel, len + i);
    }
    target.push(rawVal);
  });
  notifyVmArrayChange(targetViewModel);
  return target.length;
}
