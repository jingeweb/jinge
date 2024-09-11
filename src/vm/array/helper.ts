import { GlobalViewModelWeakMap, VM_RAW, type ViewModel, addParent, removeParent } from '../core';
import { isObject } from '../../util';

export function removeArrayItemVmParent(val: unknown, targetViewModel: ViewModel, index: number) {
  const valVm = isObject(val)
    ? val[VM_RAW]
      ? (val as ViewModel)
      : GlobalViewModelWeakMap.get(val)
    : undefined;
  valVm && removeParent(valVm, targetViewModel, index);
  return valVm;
}

/**
 * 将数组中从 start 到 end(包含）的元素的 vm parent 整体进行移位。
 * 数组执行 shift/unshift/splice 函数后，元素位置发生了移位，其绑定的 vm parent 的属性名也需要对应更新，才能保证元素发生变更时能正确向上传递变更。
 */
export function moveArrayItemsVmParentIndex(
  target: unknown[],
  targetViewModel: ViewModel,
  deltaIndex: number,
  start: number,
  end: number,
) {
  if (start > end) {
    return;
  }
  /**
   * 当 deltaIndex 大于 0（比如 unshift 函数）时，需要从数组的最后一个元素向第一个元素迭代。
   * 当 deltaIndex 小于 0（比如 shift 函数）时，需要从数组的一个元素向最后一个元素迭代。
   * 当元素里相邻的元素，是同一个 ViewModel 数据时，如果不注意这个迭代方向，先 remove parent 再 add parent 会导致丢失 parent 信息。
   * 比如：
   * ```ts
   * const a = vm({a: 10});
   * const arr = vm([a, a]);
   * arr.unshift(1);
   * ```
   * unshift 函数执行后，arr 里的两个元素要向后位移一位。如果依次执行 a@0 -> a@1, a@1 -> a@2
   *   a@0 -> a@1 时，removeParent 后 a 的 parent 就只剩 arr[1] 了，因为 parent 信息用的 Set 记录的。
   *   a@1 -> a@2 后，parent 信息里就只剩 arr[2] 了。
   * 这样就丢失了 a@1 的 parent 信息：arr[1]。
   * 如果从后向前迭代，则可以避免这个问题。
   */
  let idxStart = deltaIndex > 0 ? end : start;
  const idxEnd = deltaIndex > 0 ? start : end;

  const step = deltaIndex > 0 ? -1 : 1;
  while (true) {
    const vm = removeArrayItemVmParent(target[idxStart], targetViewModel, idxStart);
    vm && addParent(vm, targetViewModel, idxStart + deltaIndex);
    if (idxStart == idxEnd) break;
    idxStart += step;
  }
}
