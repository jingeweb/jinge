import type { ViewModelArray } from '../core';
import { notifyVmArrayChange } from '../watch';
import { removeArrayItemVmParent } from './helper';

export function arraySetLength(targetViewModel: ViewModelArray, target: unknown[], value: number) {
  const oldLen = target.length;
  if (oldLen === value) return; // 长度未变，直接返回。
  if (oldLen > value) {
    for (let i = value; i < oldLen; i++) {
      removeArrayItemVmParent(target[i], targetViewModel, i);
    }
  }
  target.length = value;
  notifyVmArrayChange(targetViewModel);
}
