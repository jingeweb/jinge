import type { AnyFn, AnyObj, PropertyPathItem, WatchHandler, WatchOptions } from '../../src';
import {
  type UnwatchFn,
  VM_PARENTS,
  VM_RAW,
  VM_WATCHERS,
  type ViewModel,
  destroyViewModelCore,
  isViewModel,
  vm,
  vmIgnore,
  vmRaw,
  vmWatch,
} from '../../src';

describe('vm:object', () => {
  it('view-model to raw', () => {
    const a: AnyObj = { a: 10 };
    const va = vm(a);
    a.b = { b: 20 };
    expect(vmRaw(va)).toStrictEqual({
      a: 10,
      b: { b: 20 },
    });
    const dt = new Date();
    expect(vmRaw(dt)).toBe(dt);
    expect(vmRaw(10 as unknown as object)).toBe(10);
  });
  it('ignore view-model', () => {
    const a: AnyObj = { a: 10 };
    const va = vm(a);
    expect(va === a).toBe(false);
    const b = { b: 20 };
    vmIgnore(b);
    va.b = b;
    expect(isViewModel(va.b)).toBe(false);
    const vb = vm(b);
    expect(vb === b).toBe(true);
    const vc = vm(10 as unknown as object);
    expect(vc === (10 as unknown as object)).toBe(true);
  });

  function expectParent(v: ViewModel, parent: ViewModel, prop: PropertyPathItem) {
    expect(!!v[VM_PARENTS]?.get(parent)?.has(prop)).toBe(true);
  }
  it('object to view-model', () => {
    const a = { a: 10, aa: { a: 20 } } as AnyObj;
    const va = vm(a) as ViewModel;
    const vb = vm(a) as ViewModel;
    const vc = vm(va) as ViewModel;

    expect(va === vb && va === vc).toBe(true);
    expect(va[VM_RAW] === a).toBe(true);
    expect(isViewModel(va.aa)).toBe(true);

    const f: AnyObj = { f: { ff: 10 } };
    va.f2 = f;
    expect(va.f2 !== f).toBe(true);
    expect(a.f2 === f).toBe(true);

    va.d = new Boolean(true);
    const e = { e: 'eee' };
    va.e = vmIgnore(e);

    expect(JSON.stringify(va[VM_RAW])).toBe(
      JSON.stringify({
        a: 10,
        aa: { a: 20 },
        f2: f,
        d: true,
        e,
      }),
    );

    const vf = vm(f) as ViewModel;
    expect(va.f2 === vf).toBe(true);
    expectParent(vf, va, 'f2');
    {
      expectParent(vf.f, vf, 'f');

      expect(vf.f[VM_PARENTS].size).toBe(1);
    }

    {
      const oo = vm({}) as ViewModel;
      oo.k = f;
      expect(oo.k).toBe(va.f2);
      const oo2 = vm({}) as ViewModel;
      oo2.k = f;
      expect(oo.k === oo2.k && oo2.k === vf).toBe(true);
      expectParent(vf, va, 'f2');
      expectParent(vf, oo, 'k');
      expectParent(vf, oo2, 'k');
      expect(vf[VM_PARENTS]?.size).toBe(3);

      va.oo = oo;
      expect(oo[VM_PARENTS]!.size).toBe(1);
      expect(isViewModel(a.oo)).toBe(false);

      va.f2 = oo;
      expect(vf[VM_PARENTS]?.size).toBe(2);
      expect(oo[VM_PARENTS]?.size).toBe(1);
      expect(oo[VM_PARENTS]?.get(va)?.size).toBe(2);
      expectParent(oo, va, 'oo');
      expectParent(oo, va, 'f2');
      expect(isViewModel(a.f2)).toBe(false);
      expect(a.f2 === a.oo).toBe(true);

      va.f2 = oo;
      expect(oo[VM_PARENTS]?.get(va)?.size).toBe(2);

      va.f2 = 30;
      expect(oo[VM_PARENTS]!.size).toBe(1);
      va.f2 = 30;
      expect(a.f2).toBe(30);
      va.f2 = Symbol();
      expect(typeof a.f2).toBe('symbol');
      const sp = Symbol();
      va[sp] = 50;
      expect(a[sp]).toBe(50);

      va[sp] = oo;
      expect(JSON.stringify(a[sp])).toBe(JSON.stringify(oo[VM_RAW]));
    }
  });
  it('symbol property', () => {
    const va: AnyObj = vm({});
    const p1 = Symbol();
    const vb = vm({ b: 10 });
    va[p1] = vb;
    expect(isViewModel(va[p1])).toBe(false);
    expect(va[p1]).toBe(vmRaw(vb));
  });
  it('destroy view-model', () => {
    const va = vm({ a: 10, b: { c: { c: 3 } } } as AnyObj) as ViewModel;
    const vb = va.b;
    vmWatch(va, () => {
      /* */
    });
    destroyViewModelCore(vb);
    destroyViewModelCore(va);
    expect(vb[VM_PARENTS]?.size).toBe(0);
    expect(va[VM_WATCHERS]?.size).toBe(0);
  });
});

function doWatch(
  vm: ViewModel,
  expectFn: AnyFn,
  updateFn: AnyFn,
  path?: PropertyPathItem | PropertyPathItem[],
  options?: WatchOptions,
) {
  setTimeout(updateFn);
  return new Promise<void>((resolve) => {
    let unwatchFn: UnwatchFn;
    const cb: WatchHandler = (nv, ov, p) => {
      expectFn(nv, ov, p);
      unwatchFn?.();
      resolve();
    };
    if (path) {
      unwatchFn = vmWatch(vm, path as PropertyPathItem[], cb, options);
    } else {
      unwatchFn = vmWatch(vm, cb);
    }
  });
}
describe('watch:object', () => {
  it('simple watch', async () => {
    const va = vm({ a: 10 } as AnyObj) as ViewModel;
    const unwatch = vmWatch(
      va,
      'a',
      (v) => {
        expect(v).toBe(10);
      },

      {
        immediate: true,
      },
    );
    unwatch();
    await doWatch(
      va,
      (v) => {
        expect(va[VM_WATCHERS]?.size).toBe(1);
        expect(v).toBe(20);
      },
      () => {
        va.a = 20;
      },
      'a',
    );
    expect(va[VM_WATCHERS]?.size).toBe(0);

    await doWatch(
      va,
      (v) => {
        expect(v === va).toBe(true);
        expect(JSON.stringify(v[VM_RAW])).toBe(JSON.stringify({ a: 20, b: 20 }));
      },
      () => {
        va.b = 20;
      },
    );

    await doWatch(
      va,
      (v) => {
        expect(v).toBe(10);
      },
      () => {
        va.b = { c: 10 };
      },
      ['b', 'c'],
      { deep: true },
    );

    await doWatch(
      va,
      (v) => {
        expect(v).toBe(20);
      },
      () => {
        va.b.c = 20;
      },
      ['b', 'c'],
      { deep: true },
    );

    await doWatch(
      va,
      (v) => {
        expect(v[VM_RAW]).toStrictEqual({ c: 30 });
      },
      () => {
        va.b.c = 30;
      },
      'b',
      { deep: true },
    );
  });
});
