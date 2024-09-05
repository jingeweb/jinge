import { VM_RAW, type ViewModelArray, removeParent } from '../core';
import { notifyVmArrayChange } from '../watch';

export function arrayPop(target: ViewModelArray) {
  const rawArr = target[VM_RAW];
  if (rawArr.length === 0) {
    return undefined;
  }
  const val = rawArr.pop();
  // 这里不能用 target.pop()，因为 target 的填充数据可能是稀疏不足的，不一定和 rawArr 完整对齐。
  // 只有当 rawArr 里有 object 数据时，target 才会在对位置有 ViewMode
  const viewModel = target[rawArr.length];
  // 同理，只有 target.length > rawArr.length 时才需要收缩 target.length，否则保持 target 的稀疏性。
  if (target.length > rawArr.length) {
    target.length = rawArr.length;
  }
  viewModel && removeParent(viewModel, target, rawArr.length);
  notifyVmArrayChange(target);
  return viewModel ?? val;
}
