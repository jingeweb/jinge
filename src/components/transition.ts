import { addEvent, clearImmediate, removeEvent, setImmediate } from '../util';
import { Attributes, Component } from '../core/component';
import {
  AFTER_ENTER,
  AFTER_LEAVE,
  BEFORE_ENTER,
  BEFORE_LEAVE,
  ENTER_CANCELLED,
  LEAVE_CANCELLED,
  getDurationType,
} from '../core/transition';

export interface TransitionFns {
  __enter: (isFirst?: boolean) => Promise<void>;
  __leave: (isFirst?: boolean) => Promise<void>;
}

export interface ClassNames {
  enterFrom: string;
  enterActive: string;
  enterTo: string;
  leaveFrom: string;
  leaveActive: string;
  leaveTo: string;
}

export type TransitionComponentAttrs = Attributes<{
  /** 是否对初始渲染使用过渡，默认为 false */
  appear?: boolean;
  name?: string;
  classNames?: ClassNames;
}>;

function genClassNames(name?: string) {
  name = name || 'jg';
  return {
    enterFrom: `${name}-enter-from`,
    enterActive: `${name}-enter-active`,
    enterTo: `${name}-enter-to`,
    leaveFrom: `${name}-leave-from`,
    leaveActive: `${name}-leave-active`,
    leaveTo: `${name}-leave-to`,
  };
}

function doTrans(comp: TransitionComponent, isEnter: boolean, el: HTMLElement) {
  const type = isEnter ? 'enter' : 'leave';
  const fromClass = comp._cs[`${type}From`];
  const activeClass = comp._cs[`${type}Active`];
  const toClass = comp._cs[`${type}To`];

  el.classList.add(fromClass, activeClass);
  comp.__notify(isEnter ? BEFORE_ENTER : BEFORE_LEAVE, el);
  let cancel: (notify: boolean) => void = undefined;
  let imm = setImmediate(() => {
    imm = 0;
    // 将 fromClass 移除，同时加入 toClass 触发动画
    // 但如果 getDurationType 为 null，说明 activeClass 并没生效，直接退出。
    const dt = getDurationType(el);
    if (!dt) {
      comp.__notify(isEnter ? AFTER_ENTER : AFTER_LEAVE, el);
      return;
    }
    const clear = () => {
      cancel = undefined;
      comp._t = undefined;
      removeEvent(el, dt, onEnd);
      el.classList.remove(activeClass, toClass);
    };
    const onEnd = () => {
      clear();
      comp.__notify(isEnter ? AFTER_ENTER : AFTER_LEAVE, el);
    };
    addEvent(el, dt, onEnd);
    cancel = (notify: boolean) => {
      clear();
      notify && comp.__notify(isEnter ? ENTER_CANCELLED : LEAVE_CANCELLED, el);
    };
    el.classList.remove(fromClass);
    el.classList.add(toClass);
    comp.__notify(type, el);
  });

  comp._t = (notify: boolean) => {
    if (imm) clearImmediate(imm);
    if (cancel) cancel(notify);
  };
}

export class TransitionComponent extends Component {
  _cs: ClassNames;
  _appear: boolean;
  /** 当前正在进行的过渡的取消函数，不为 undefined 时代表正在过渡中 */
  _t?: (notify: boolean) => void;

  constructor(attrs: TransitionComponentAttrs) {
    super(attrs);

    this._cs = attrs.classNames || genClassNames(attrs.name);
    this._appear = attrs.appear === true;
  }

  __transition(isEnter: boolean, isFirst: boolean) {
    if (this._t) {
      // 调用 __transition 方必须保障不会有正在进行中的过渡。调用方需要调用 __cancel 来清理未完成的过渡。
      throw new Error('assert failed: previous transition in progress');
    }

    if (isFirst && !this._appear) {
      // 初始渲染默认不启动过渡。直接通知过渡结束。
      this.__notify(isEnter ? AFTER_ENTER : AFTER_LEAVE);
      return;
    }

    const el = this.__firstDOM as HTMLElement;
    if (el.nodeType === Node.ELEMENT_NODE) {
      // 执行实际的过渡。doTrans 函数中会将 this._t 变更为当前过渡的取消函数。
      doTrans(this, isEnter, el);
    }
  }

  /**
   * 取消当前正在进行的渡（如果当前处于过渡中的话）
   */
  __cancel(notify: boolean) {
    if (this._t) {
      const f = this._t;
      this._t = undefined;
      // console.log('stop previous transition');
      f(notify);
    }
  }

  __destroy(removeDOM?: boolean) {
    this.__cancel(false); // 取消正在进行中的过渡动画，并且不通知事件
    return super.__destroy(removeDOM);
  }
}
