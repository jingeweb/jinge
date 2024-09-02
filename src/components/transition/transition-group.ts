import {
  CONTEXT,
  DEFAULT_SLOT,
  newComponentWithDefaultSlot,
  renderFunctionComponent,
  ROOT_NODES,
  SLOTS,
  type ComponentHost,
} from '../../core';

import type { PropsWithSlots } from '../../jsx';
import { vm, vmWatch } from '../../vm';
import { For, type ForSlot } from '../for';
import type { KeyMap, type EachVm, type Key } from '../for/common';
import type { TransitionClassnames, TransitionProps } from './transition';
import { Transition } from './transition';

export type TransitionGroupProps<T> = {
  loop: T[];
  /** TransitionGroup 必须指定 keyFn */
  keyFn: (v: T, index: number) => Key;
  appear?: boolean;
  classnames: TransitionClassnames;
};

export function TransitionGroup<T>(
  this: ComponentHost,
  props: PropsWithSlots<TransitionGroupProps<T>, ForSlot<T>>,
) {
  const classnames = Object.fromEntries(Object.entries(props.classnames));
  const appear = !!props.appear;
  const keyFn = props.keyFn;
  const state = vm({
    loop: appear ? [] : props.loop.slice(),
    keyFn,
  });
  const oldStates = new Map<Key, TransitionProps>();

  const renderEachFn = (host: ComponentHost, forEach: EachVm<T>) => {
    const eachKey = forEach.key as Key;
    const eachState: TransitionProps = vm({
      ...classnames,
      isEnter: true,
      destroyAfterLeave: false,
      appear: true,
      onAfterLeave: () => {
        //
        console.log(forEach, 'leaved');
      },
    });
    oldStates.set(eachKey, eachState);
    console.log(eachState);
    const el = newComponentWithDefaultSlot(host[CONTEXT], (tranHost) => {
      return this[SLOTS][DEFAULT_SLOT]?.(tranHost, forEach) ?? [];
    });
    host[ROOT_NODES].push(el);
    return renderFunctionComponent(el, Transition, eachState);
  };
  const render = () => {
    // state.loop.forEach((it, i) => oldKeys.set(keyFn(it, i), i));
    const el = newComponentWithDefaultSlot(this[CONTEXT], renderEachFn);
    const nodes = renderFunctionComponent(el, For, state);
    return nodes;
  };

  vmWatch(
    props,
    'loop',
    (v, _, path) => {
      if (!path || path.length <= 1) {
        // continue
      } else {
        // 如果发生变更的路径 cp.length > 1，说明是数组里某个具体的元素发生变更，
        // 这种情况下 For 组件不需要响应和更新渲染。render 模板中有依赖到这个具体元素的地方，会在
        // ForEach 组件中自动被更新（因为会在这个具体元素上建立监听）
        return;
      }
      const newKeys = new Map();
      v.forEach((it, i) => newKeys.set(keyFn(it, i), i));
      const oldKeys = new Set();
      state.loop.forEach((old, i) => {
        const oldKey = keyFn(old, i);
        oldKeys.add(oldKey);
        const newIdx = newKeys.get(oldKey);
        const oldState = oldStates.get(oldKey) as TransitionProps;
        if (newIdx === undefined) {
          oldState.isEnter = false;
        } else {
          oldState.isEnter = true;
        }
        newKeys.delete(oldKey);
      });
      newKeys.forEach((i) => {
        state.loop.push(v[i]);
      });
    },
    {
      deep: true,
    },
  );

  return render();
}
