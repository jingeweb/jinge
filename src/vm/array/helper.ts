import { ArrayProxyHandler } from './index';
import {
  VM_PROXY,
  VM_RAW,
  type ViewModelArray,
  type ViewModelRaw,
  addParent,
  mayBeVm,
} from '../core';
import { wrapViewModel } from '../proxy';

export function wrapArray(arr: ViewModelRaw<ViewModelRaw[]>) {
  const viewModel = [] as unknown as ViewModelArray;
  viewModel[VM_RAW] = arr;
  const proxy = new Proxy(viewModel, ArrayProxyHandler);
  viewModel[VM_PROXY] = arr[VM_PROXY] = proxy;
  arr.forEach((it, i) => {
    if (mayBeVm(it)) {
      const itViewModel = it[VM_PROXY] ?? wrapViewModel(it);
      addParent(itViewModel, viewModel, i);
      viewModel[i] = itViewModel;
    }
  });
  return proxy;
}

// const ArrayFns = {
//   splice(target: ViewModelArray, idx: number, delCount: number, ...args: ViewModel[]) {
//     const rawArr = target[VM_RAW] as ViewModelRaw[] & ViewModel;
//     if (args.length === 0 && (delCount === 0 || rawArr.length === 0)) return wrapObj([]);

//     if (idx < 0) idx = 0;
//     if (idx === 0) {
//       if (delCount === 0) {
//         return A;
//       }
//     }
//     args.forEach((arg, i) => {
//       if (_argAssert(arg, 'splice')) {
//         addParent(arg, target, idx + i);
//       }
//     });

//     for (let i = 0; i < delCount; i++) {
//       if (idx + i >= target.length) break;
//       const el = target[idx + i];
//       if (isViewModel(el)) {
//         removeParent(el, target, idx + i);
//       }
//     }
//     const delta = args.length - delCount;
//     if (delta !== 0) {
//       for (let i = idx + delCount; i < target.length; i++) {
//         const el = target[i];
//         if (!isViewModel(el)) {
//           continue;
//         }
//         shiftParent(el, target, i, delta);
//       }
//     }
//     const rtn = wrapSubArray(target.splice(idx, delCount, ...args) as ViewModelArray);
//     notifyVmArrayChange(target);
//     return rtn;
//   },
//   shift(target: any) {

//   },

//   pop(target: any) {

//   },
//  ,
//   fill(target: any, v: any): ViewModelArray {

//   },

// };
