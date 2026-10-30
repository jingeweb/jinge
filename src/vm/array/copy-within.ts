import { type ViewModelArray, addParent } from '../core';
import { getVmAndRaw } from '../object';
import { notifyVmArrayChange } from '../watch';
import { normalizeArrayIndex, removeArrayItemVmParent } from './helper';

export function arrayCopyWithin(
  targetViewModel: ViewModelArray,
  target: unknown[],
  destination: number,
  start: number,
  end?: number,
) {
  const length = target.length;
  const to = normalizeArrayIndex(destination, length);
  const from = normalizeArrayIndex(start, length);
  const final = normalizeArrayIndex(end === undefined ? length : end, length);
  const count = Math.min(final - from, length - to);
  if (count <= 0 || to === from) return targetViewModel;

  for (let index = to; index < to + count; index++) {
    removeArrayItemVmParent(target[index], targetViewModel, index);
  }
  // Native copying preserves overlap order and copies holes by deleting targets.
  target.copyWithin(to, from, final);
  for (let index = to; index < to + count; index++) {
    const [child] = getVmAndRaw(target[index]);
    if (child) addParent(child, targetViewModel, index);
  }
  notifyVmArrayChange(targetViewModel);
  return targetViewModel;
}
