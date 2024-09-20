import {
  For,
  If,
  Lazy,
  Portal,
  Transition,
  TransitionGroup,
  TransitionGroupItem,
} from '../components';
import {
  type ComponentHost,
  type Context,
  addUnmountFn,
  replaceRenderFunctionComponent,
} from '../core';
import type { FC } from '../jsx';

export type HMR_FC = FC & { __hmrId__: string };

export interface JingeHmrRuntime {
  replaceComponentInstance(fc: FC): void;
  registerComponentInstance(
    fc: FC,
    instance: ComponentHost,
    props?: object,
    context?: Context,
  ): void;
  registerFunctionComponent(fc: FC, __hmrId__: string): void;
  getLatestFunctionComponent(fc: FC): FC;
}

export function initHmr() {
  const ComponentStore = new Map<string, HMR_FC>();

  function registerFunctionComponent(fc: FC, __hmrId__: string) {
    (fc as HMR_FC).__hmrId__ = __hmrId__;
    ComponentStore.set(__hmrId__, fc as HMR_FC);
  }

  [If, For, Transition, TransitionGroup, Transition, TransitionGroupItem, Portal, Lazy].forEach(
    (fc) => {
      registerFunctionComponent(fc, `jinge::core::${fc.name}`);
    },
  );

  function getLatestFunctionComponent(fc: FC) {
    const __hmrId__ = (fc as HMR_FC).__hmrId__;
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
    const __hmrId__ = (fc as HMR_FC).__hmrId__;
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
    if (!(fc as HMR_FC).__hmrId__) return; // 忽略没有 __hmrId__ 的组件
    const comps = [...(InstanceStore.get((fc as HMR_FC).__hmrId__)?.values() ?? [])];
    // !! 注意此处必须将 store.get 的 Set 转换成 array 后再遍历。如果直接遍历 Set.forEach，
    // 新渲染的 component 又会注册到 Set 中，导致无限循环。
    comps.forEach((item) => {
      replaceRenderFunctionComponent(item.comp, fc, item.context, item.props);
    });
  }

  window.__JINGE_HMR__ = {
    getLatestFunctionComponent,
    registerFunctionComponent,

    registerComponentInstance,
    replaceComponentInstance,
  };
}
