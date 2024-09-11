/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnyObj, ViewModel, ViewModelArray } from '../../src';
import { VM_PARENTS, VM_RAW, isViewModel, vm, vmIgnore, vmRaw } from '../../src';

function expectParent(vm: ViewModel, index: number, parent: any) {
  expect(!!vm[VM_PARENTS]?.get(parent)?.has(index)).toBe(true);
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
  it('wrap array & set length', () => {
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
    const k = a.a[3];
    expect(k === va.a[3]).toBe(true);
    expectParent(k, 3, va.a);
    va.a.length = 4;
    va.a.length = 3;
    expect(k[VM_PARENTS].size).toBe(0);
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
    arr.length = 0;
    expect(arr.push()).toBe(0);
    expect(arr.pop()).toBeUndefined();
  });
  it('array shift & unshift', () => {
    const arr: any[] = vm([1, 2, { a: 10 }]);
    const k = arr[2];
    expect(isViewModel(k)).toBe(true);
    expect(arr.shift()).toBe(1);
    expect(arr.shift()).toBe(2);
    expect(arr[0] === k).toBe(true);
    expectParent(arr[0], 0, arr);
    arr.unshift(1, { b: 'b' });
    expect(arr[0]).toBe(1);
    expectParent(arr[1], 1, arr);
    expectParent(k, 2, arr);
    expect(arr.shift()).toBe(1);
    expect(arr.shift()).toStrictEqual({ b: 'b' });
    expect(arr.shift()).toBe(k);
    expect(k[VM_PARENTS].size).toBe(0);
    expect(arr.shift()).toBeUndefined();
    const c = vm({ c: 'c' } as AnyObj) as ViewModel;
    arr.unshift(c);
    expect(arr[0][VM_RAW] === c[VM_RAW] && arr[0] === c).toBe(true);
    expect(arr.unshift()).toBe(1);
  });
  it('array reverse & sort', () => {
    const arr = vm([1, 3, 2, { a: 10 }]) as unknown as ViewModel;
    expect(isViewModel(arr[3])).toBe(true);
    expectParent(arr[3] as unknown as ViewModel, 3, arr);
    let arr2 = arr.reverse();
    expect(arr === arr2).toBe(true);
    expect(arr[VM_RAW]).toStrictEqual([{ a: 10 }, 2, 3, 1]);
    expectParent(arr[0], 0, arr);
    arr2 = arr.sort();
    expect(arr2 === arr).toBe(true);
    expect(arr[VM_RAW]).toStrictEqual([1, 2, 3, { a: 10 }]);
    arr.length = 0;
    expect(arr.reverse()).toBe(arr);
    expect(arr.sort()).toBe(arr);
    arr2 = vm([{ a: 10 }, vm({ b: 'b' })]);
    arr2.reverse();
    expect(arr2[VM_RAW]).toStrictEqual([{ b: 'b' }, { a: 10 }]);
    arr2.sort();
    expect(arr2[VM_RAW]).toStrictEqual([{ b: 'b' }, { a: 10 }]);
  });
  it('array fill', () => {
    const a = vm(new Array(10)) as ViewModelArray<any>;

    a.fill(4, 1);
    expect(a[0]).toBeUndefined();
    a.fill(5, 2, 1);
    expect(a[2]).toBe(4);
    expect(a[8] === 4).toBe(true);
    const k = vm({ k: 'k' } as AnyObj) as ViewModel;
    a.fill(k);
    expectParent(k, 0, a);
    expect(k[VM_PARENTS]?.get(a)?.size).toBe(10);
    a.fill({ b: 'b' });
    expect(k[VM_PARENTS]?.size).toBe(0);
    expect(a[0][VM_PARENTS].get(a).size).toBe(10);
    a.length = 0;
    expect(a.fill(10).length).toBe(0);
  });
  it('array splice', () => {
    const arr = vm([1, 2, { a: 'a' }] as unknown[]) as ViewModelArray;
    arr.splice(2, 0, arr[2]);
    const va = arr[2] as unknown as ViewModel;
    expectParent(va, 2, arr);
    expectParent(va, 3, arr);
    expect(arr.splice(3, 0)).toStrictEqual([]);

    arr.splice(1, 0, { b: 'b' }, { c: 'c' });
    expect(arr[4]).toBe(va);
    expectParent(va, 4, arr);
    expectParent(va, 5, arr);
    expectParent(arr[1], 1, arr);
    expect(arr[1]).toStrictEqual({ b: 'b' });

    arr.splice(2, 1);
    expectParent(va, 3, arr);
    expectParent(va, 4, arr);

    const vb = arr[1] as unknown as ViewModel;
    expect(arr.splice(1, 1, { c: 'c' }, { d: 'd' })[0]).toBe(vb);
    expectParent(va, 4, arr);
    expect(arr.splice(1, 2)).toStrictEqual([{ c: 'c' }, { d: 'd' }]);
    expectParent(va, 2, arr);

    const arr2 = arr.splice(0, arr.length);
    expect(arr.length).toBe(0);
    expect(arr2 === arr).toBe(false);
    expectParent(va, 2, arr2);
    arr.splice(0, 0, 1 as any, va);
    expect(arr[0]).toBe(1);
    expectParent(va, 1, arr);
    expect(va[VM_PARENTS]?.size).toBe(2);

    expect(arr.splice(1).length).toBe(0);
    expect((arr as any).splice().length).toBe(0);
  });
});
