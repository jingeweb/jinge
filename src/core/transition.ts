export enum TransitionStates {
  ENTERING = 1,
  ENTERED = 2,
  LEAVING = 3,
  LEAVED = 4
}

export type DurationType = 'transitionend' | 'animationend';
export type Duration = {
  type: DurationType;
  time: number;
};

export function getDurationType(el: Element): DurationType {
  const cst = getComputedStyle(el);
  if (cst.getPropertyValue('transition-duration') !== '0s') {
    return 'transitionend';
  } else if (cst.getPropertyValue('animation-duration') !== '0s') {
    return 'animationend';
  }
  return null;
}

function parseDuration(v: string): number {
  if (/ms$/.test(v)) {
    return parseInt(v);
  } else if (/s$/.test(v)) {
    return parseFloat(v) * 1000;
  } else {
    return 0;
  }
}

export function getDuration(el: Element): Duration {
  const cst = getComputedStyle(el);
  let dur = cst.getPropertyValue('transition-duration');
  if (dur !== '0s') {
    return {
      type: 'transitionend',
      time: parseDuration(dur)
    };
  }
  dur = cst.getPropertyValue('animation-duration');
  if (dur !== '0s') {
    return {
      type: 'animationend',
      time: parseDuration(dur)
    };
  }
  return {
    type: null,
    time: 0
  };
}
