import {
  getComputedStyle,
  getCSPropertyValue
} from '../dom';

export const TS_TRANSITION_END = 'transitionend';
export const TS_ANIMATION_END = 'animationend';
export const TS_TRANSITION_DURATION = 'transition-duration';
export const TS_ANIMATION_DURATION = 'animation-duration';
export const TS_TRANSITION = 'transition';
export const TS_ZERO_S = '0s';
export const TS_ENTER = 'enter';
export const TS_LEAVE = 'leave';
export const TS_C_ENTER = '-enter';
export const TS_C_LEAVE = '-leave';
export const TS_C_ENTER_ACTIVE = '-enter-active';
export const TS_C_LEAVE_ACTIVE = '-leave-active';
export const TS_BEFORE_ENTER = 'before-enter';
export const TS_AFTER_ENTER = 'after-enter';
export const TS_BEFORE_LEAVE = 'before-leave';
export const TS_AFTER_LEAVE = 'after-leave';
export const TS_ENTER_CANCELLED = 'enter-cancelled';
export const TS_LEAVE_CANCELLED = 'leave-cancelled';

export const TS_STATE_ENTERING = 1;
export const TS_STATE_ENTERED = 2;
export const TS_STATE_LEAVING = 3;
export const TS_STATE_LEAVED = 4;

export function getDurationType(el) {
  const cst = getComputedStyle(el);
  if (getCSPropertyValue(cst, TS_TRANSITION_DURATION) !== TS_ZERO_S) {
    return TS_TRANSITION_END;
  } else if (getCSPropertyValue(cst, TS_ANIMATION_DURATION) !== TS_ZERO_S) {
    return TS_ANIMATION_END;
  }
  return null;
}
