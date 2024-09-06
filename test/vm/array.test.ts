/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnyObj, ViewModel } from 'src';
import { VM_PARENTS, isViewModel, vm, vmIgnore, vmRaw } from 'src/vm';

function expectParent(vm: ViewModel, index: number, parent: any) {
  const ps = vm[VM_PARENTS];
  const pa = ps?.get(index);
  expect(pa?.has(parent)).toBe(true);
}
describe('vm:array', () => {
  it('view-model to raw', () => {
    const a = [1, { a: 10 }, 2];
    const va = vm(a);
    va.push(3);
    expect(vmRaw(va)).toStrictEqual([1, { a: 10 }, 2, 3]);
  });
  it('ignore view-model', () => {
    const a = [1, 2, { a: 10 }];
    vmIgnore(a);
    const va = vm(a);
    expect(isViewModel(va)).toBe(false);
  });
  it('wrap array', () => {
    const a: AnyObj = { a: [1, 2, { b: 10 }, vm({ o: 'o' })] };
    const va = vm(a);
    expect(a.a[2] === va.a[2]).toBe(false);
    expect(a.a[3] === va.a[3]).toBe(true);
    expect(isViewModel(va.a)).toBe(true);
    expect(isViewModel(va.a[2])).toBe(true);
    expect(va.a[0]).toBe(1);
    va.a[0] = { c: 10 };
    expect(isViewModel(va.a[0])).toBe(true);
    const vb = vm(va.a[0]);
    expect(vb === va.a[0]).toBe(true);
    expectParent(vb, 0, va.a);
  });
  it('array push & pop', () => {
    const arr: any[] = vm([1, { a: 10 }]);
    const vc = vm({ c: 'c' } as AnyObj) as ViewModel;
    const vd = vm(vc);
    expect(vc === vd).toBe(true);
    arr.push(2, { b: 'b' }, vc, new Boolean(true));
    expect(arr.length).toBe(6);
    expectParent(vc, 4, arr);
    expectParent(arr[1], 1, arr);
    expectParent(arr[3], 3, arr);
    arr[4] = vd;
    expectParent(vc, 4, arr);
    let el = arr.pop();
    expect(el.valueOf()).toBe(true);
    el = arr.pop();
    expect(el === vc).toBe(true);
    expect(el[VM_PARENTS].size === 0).toBe(true);
    expect(arr.length).toBe(4);
  });
});
