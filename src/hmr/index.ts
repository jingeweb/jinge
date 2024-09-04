import { For, If, Portal, Transition, TransitionGroup, TransitionGroupItem } from '../components';
import {
  type ComponentHost,
  type Context,
  addUnmountFn,
  getLastDOM,
  handleRenderDone,
  renderFunctionComponent,
  resetComponent,
} from '../core';
import { type AnyFn, createComment, createFragment, insertAfter, insertBefore } from '../util';

export function initHmr() {
  type FC = AnyFn & { __hmrId__: string };

  const ComponentStore = new Map<string, AnyFn>();

  function registerFunctionComponent(fc: FC, __hmrId__: string) {
    fc.__hmrId__ = __hmrId__;
    ComponentStore.set(__hmrId__, fc);
  }

  [If, For, Transition, TransitionGroup, Transition, TransitionGroupItem, Portal].forEach((fc) => {
    registerFunctionComponent(fc as FC, `jinge::core::${fc.name}`);
  });

  function getLatestFunctionComponent(fc: FC) {
    const __hmrId__ = fc.__hmrId__;
    if (!__hmrId__) return fc;
    return ComponentStore.get(__hmrId__) ?? fc;
  }

  const InstanceStore = new Map<
    string,
    Set<{
      comp: ComponentHost;
      props: object;
      context: Context;
    }>
  >();
  function registerComponentInstance(
    fc: FC,
    instance: ComponentHost,
    props: object,
    context: Context,
  ) {
    const __hmrId__ = fc.__hmrId__;
    if (!__hmrId__) {
      console.warn(`Component __hmrId__ not found, ignored.`, fc);
      return;
    }
    let comps = InstanceStore.get(__hmrId__);
    if (!comps) InstanceStore.set(__hmrId__, (comps = new Set()));
    const item = {
      comp: instance,
      props,
      context,
    };
    comps.add(item);
    addUnmountFn(instance, () => {
      comps.delete(item);
    });
  }

  function replaceComponentInstance(fc: FC) {
    if (!fc.__hmrId__) throw new Error('unexpected, missing __hmrId__');
    const comps = [...(InstanceStore.get(fc.__hmrId__)?.values() ?? [])];
    // !! 注意此处必须将 store.get 的 Set 转换成 array 后再遍历。如果直接遍历 Set.forEach，
    // 新渲染的 component 又会注册到 Set 中，导致无限循环。
    comps.forEach((item) => {
      const placeholder = createComment('');
      const lastEl = getLastDOM(item.comp);
      const $parent = lastEl.parentNode as Node;
      insertAfter($parent, placeholder, lastEl);
      resetComponent(item.comp, item.context);
      const nodes = renderFunctionComponent(item.comp, fc, item.props);
      insertBefore($parent, nodes.length > 1 ? createFragment(nodes) : nodes[0], placeholder);
      handleRenderDone(item.comp);
      $parent.removeChild(placeholder);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__JINGE_HMR__ = {
    getLatestFunctionComponent,
    registerFunctionComponent,

    registerComponentInstance,
    replaceComponentInstance,
  };
}
