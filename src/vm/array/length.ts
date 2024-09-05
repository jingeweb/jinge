import { isObject } from '../../util';
import { VM_RAW, type ViewModelArray, removeParent } from '../core';
import { notifyVmArrayChange } from '../watch';

export function arraySetLength(target: ViewModelArray, value: number) {
  const rawArr = target[VM_RAW];
  const oldLen = rawArr.length;
  if (oldLen === value) return; // 长度未变，直接返回。
  if (oldLen > value) {
    for (let i = value; i < oldLen; i++) {
      const v = target[i];
      isObject(v) && removeParent(v, target, i);
    }
  }
  rawArr.length = value;
  if (target.length > value) {
    // target 可能是空数组（如果 rawArr 里一个 ViewModel 都不是）。因此 length 扩大，rawArr 一定是填充空数据，target 不需要填充，也就不需要扩充 length
    // 只有 target.length > value 说明原先的 target 里在 value 之后的索引位置也有 ViewModel ，才需要设置新的 target.length
    target.length = value;
  }
  notifyVmArrayChange(target);
}
