import { VM_RAW, type ViewModelArray, addParent, removeParent } from '../core';
import { notifyVmArrayChange } from '../watch';

export function arrayShift(target: ViewModelArray) {
  const rawArr = target[VM_RAW];
  if (rawArr.length === 0) return undefined;
  const val = rawArr.shift();
  // target 如果不为空，就一定有一个 ViewModel 存在且和 rawArr 对应位置对齐。target.shift 就可以返回第一个元素并保持和 rawArr 的对齐。
  // target 如果为空，shift() 也是 undefined 符合预期。
  const viewModel = target.shift();
  viewModel && removeParent(viewModel, target, 0);
  target.forEach((v, i) => {
    if (v) {
      removeParent(v, target, i + 1);
      addParent(v, target, i);
    }
  });
  notifyVmArrayChange(target);
  return viewModel ?? val;
}
