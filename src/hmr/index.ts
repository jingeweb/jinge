import {
  CONTEXT,
  ComponentHost,
  type Context,
  addUnmountFn,
  destroyComponent,
  getLastDOM,
  renderFunctionComponent,
} from '../core';
import { type AnyFn, createComment, createFragment, insertAfter, insertBefore } from '../util';

export function initHmr() {
  const store = new Map<
    string,
    Set<{
      comp: ComponentHost;
      props: object;
      context: Context;
    }>
  >();
  function register(
    fc: { __hmrId__: string },
    comp: ComponentHost,
    props: object,
    context: Context,
  ) {
    if (!fc.__hmrId__) {
      console.warn(`Component __hmrId__ not found, ignored.`, fc);
      return;
    }
    let comps = store.get(fc.__hmrId__);
    if (!comps) store.set(fc.__hmrId__, (comps = new Set()));
    const item = {
      comp,
      props,
      context,
    };
    comps.add(item);
    addUnmountFn(comp, () => {
      comps.delete(item);
    });
  }

  function replace(fc: AnyFn & { __hmrId__: string }) {
    if (!fc.__hmrId__) throw new Error('unexpected, missing __hmrId__');
    const comps = [...(store.get(fc.__hmrId__)?.values() ?? [])];
    // !! 注意此处必须将 store.get 的 Set 转换成 array 后再遍历。如果直接遍历 Set.forEach，
    // 新渲染的 component 又会注册到 Set 中，导致无限循环。
    comps.forEach((item) => {
      const placeholder = createComment('');
      const lastEl = getLastDOM(item.comp);
      const $parent = lastEl.parentNode as Node;
      insertAfter($parent, placeholder, lastEl);
      destroyComponent(item.comp);
      const newComp = new ComponentHost();
      newComp[CONTEXT] = item.context;
      const nodes = renderFunctionComponent(newComp, fc, item.props);
      insertBefore($parent, nodes.length > 1 ? createFragment(nodes) : nodes[0], placeholder);
      $parent.removeChild(placeholder);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__JINGE_HMR__ = {
    register,
    replace,
  };
}
