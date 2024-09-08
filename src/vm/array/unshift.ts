import { type ViewModelArray, addParent, shouldBeVm } from '../core';
import { getVmAndRaw } from '../object';
import { wrapViewModel } from '../proxy';
import { notifyVmArrayChange } from '../watch';
import { moveArrayItemsVmParentIndex } from './helper';

export function arrayUnshift(
  targetViewModel: ViewModelArray,
  target: unknown[],
  ...args: unknown[]
) {
  const argsLen = args.length;
  const len = target.length;
  if (argsLen === 0) return len;

  len > 0 && moveArrayItemsVmParentIndex(target, targetViewModel, argsLen, 0, len - 1);
  for (let i = argsLen - 1; i >= 0; i--) {
    const arg = args[i];

    const [valVm, rawVal] = getVmAndRaw(arg);
    if (valVm) {
      addParent(valVm, targetViewModel, i);
    } else if (shouldBeVm(arg)) {
      addParent(wrapViewModel(arg), targetViewModel, i);
    }
    target.unshift(rawVal);
  }

  notifyVmArrayChange(targetViewModel);
  return len + argsLen;
}
