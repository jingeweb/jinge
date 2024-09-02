import type { TransitionClassnames } from './transition';
export function parseCls(cls?: string) {
  return cls ? cls.trim().split(/\s+/) : [];
}
export const TRANSITION_END = 'transitionend';

export function classnames2tokens(props: TransitionClassnames) {
  return [
    parseCls(props.enterClass), // enter 进入后的 class
    parseCls(props.enterActiveClass ?? props.leaveActiveClass), // enter active 开始进入（激活）的 class
    parseCls(props.leaveClass), // leave 离开后的 class
    parseCls(props.leaveActiveClass ?? props.enterActiveClass),
  ];
}
