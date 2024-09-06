import type { AnyObj } from 'src';
import {
  ONLY_DEV_TARGET,
  VM_PARENTS,
  VM_PROXY,
  VM_RAW,
  type ViewModel,
  vm,
  vmIgnore,
} from 'src/vm';

describe('vm:object', () => {
  it('object to view-model', () => {
    const a = { a: 10 } as AnyObj;
    const va = vm(a) as ViewModel;
    const vb = vm(a) as ViewModel;
    const vaCore = va[ONLY_DEV_TARGET];

    expect(JSON.stringify(vaCore)).toBe('{}');
    expect(va === vb).toBe(true);

    const c = { b: 'a' };
    const vc = vm(c);
    va.c = vc;
    va.d = new Boolean(true);

    const e = { e: 'e' };
    vmIgnore(e);
    va.e = e;

    const f = { f: { ff: 10 } };
    va.f2 = f;
    expect(va.f2 !== f).toBe(true);
    expect(a.f2 === f).toBe(true);
    expect(!a.f2[VM_PROXY]).toBe(true);

    expect(Object.keys(vaCore)).toStrictEqual(['c', 'f2']);
    expect(JSON.stringify(va[VM_RAW])).toBe(
      JSON.stringify({
        a: 10,
        c,
        d: true,
        e,
        f2: f,
      }),
    );

    const ff = (f as unknown as ViewModel)[VM_PROXY];
    expect(ff).not.toBeUndefined();
    const vf = vm(f) as unknown as ViewModel;
    expect(ff).toBe(vf);

    expect(vf === va.f2).toBe(true);
    expect(vf.f === va.f2.f).toBe(true);
    {
      const ps = (vf.f as unknown as ViewModel)[VM_PARENTS]!;
      expect(ps.size).toBe(1);
      const p = ps.entries().next().value;
      expect(p[0]).toBe('f');
      expect(p[1].size).toBe(1);

      const pa = p[1].values().next().value;
      expect(pa).toBe(vf[ONLY_DEV_TARGET]);
    }

    {
      const oo = vm({}) as ViewModel;
      oo.k = f;
      expect(oo.k).toBe(va.f2);
      const oo2 = vm({}) as ViewModel;
      oo2.k = f;
      const ps = (vf as unknown as ViewModel)[VM_PARENTS]!;
      expect(ps.size).toBe(2);
      const itr = ps.entries();
      let p1 = itr.next().value;
      expect(p1[0]).toBe('f2');
      let pas = [...p1[1].values()];
      expect(pas.length).toBe(1);
      expect(pas[0]).toBe(va[ONLY_DEV_TARGET]);
      p1 = itr.next().value;
      pas = [...p1[1].values()];
      expect(p1[0]).toBe('k');
      expect(pas.length).toBe(2);
      expect(pas[0]).toBe(oo[ONLY_DEV_TARGET]);
      expect(pas[1]).toBe(oo2[ONLY_DEV_TARGET]);

      va.oo = oo;
      expect(oo[VM_PARENTS]!.size).toBe(1);
      expect(!a.oo[VM_PROXY]).toBe(true);

      va.f2 = oo;
      expect(ps.size).toBe(1);
      expect(oo[VM_PARENTS]!.size).toBe(2);
      expect(!a.f2[VM_PROXY]).toBe(true);
      expect(a.f2 === a.oo).toBe(true);

      va.f2 = oo;

      va.f2 = {};
      expect(oo[VM_PARENTS]!.size).toBe(1);

      va.f2 = 30;
      expect(vaCore.f2).toBeUndefined();
      va.f2 = Symbol();
      expect(typeof a.f2).toBe('symbol');
      const sp = Symbol();
      va[sp] = 50;
      expect(a[sp]).toBe(50);

      va[sp] = oo;
      expect(JSON.stringify(a[sp])).toBe(JSON.stringify(oo[VM_RAW]));
    }
  });
});
