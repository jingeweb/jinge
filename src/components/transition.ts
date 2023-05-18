import { addEvent, clearImmediate, removeEvent, setImmediate } from '../util';
import { Attributes, Component } from '../core/component';
import { getDurationType } from '../core/transition';

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

async function doTrans(comp: TransitionComponent, isEnter: boolean, el: HTMLElement) {
  const type = isEnter ? 'enter' : 'leave';
  const fromClass = comp._cs[`${type}From`];
  const activeClass = comp._cs[`${type}Active`];
  const toClass = comp._cs[`${type}To`];

  el.classList.add(fromClass, activeClass);
  comp.__notify(`before-${type}`, el);
  let cancel: () => void = undefined;
  let imm = setImmediate(() => {
    imm = 0;
    // 将 fromClass 移除，同时加入 toClass 触发动画
    // 但如果 getDurationType 为 null，说明 activeClass 并没生效，直接退出。
    const dt = getDurationType(el);
    if (!dt) {
      comp.__notify(`after-${type}`, el);
      return;
    }
    const onEnd = () => {
      cancel = undefined;
      removeEvent(el, dt, onEnd);
      el.classList.remove(activeClass, toClass);
      comp.__notify(`after-${type}`, el);
    };
    addEvent(el, dt, onEnd);
    cancel = () => {
      cancel = undefined;
      removeEvent(el, dt, onEnd);
      comp.__notify(`${type}-cancelled`, el);
    };
    el.classList.remove(fromClass);
    el.classList.add(toClass);
    comp.__notify(type, el);
  });

  comp._t = () => {
    if (imm) clearImmediate(imm);
    if (cancel) cancel();
  };
}

export class TransitionComponent extends Component {
  _cs: ClassNames;
  _appear: boolean;
  /** 当前正在进行的过渡 */
  _t: () => void;

  constructor(attrs: TransitionComponentAttrs) {
    super(attrs);

    this._cs = attrs.classNames || genClassNames(attrs.name);
    this._appear = attrs.appear === true;
  }

  private async __trans(isEnter: boolean, isFirst: boolean) {
    if (isFirst && !this._appear) {
      // 初始渲染默认不启动过渡。
      return;
    }
    // 如果上一个过渡还未结束，先结束上一个过渡。
    this._t?.();
    const el = this.__firstDOM as HTMLElement;
    if (el.nodeType !== Node.ELEMENT_NODE) {
      this._t = undefined;
      // 如果不是 html element 则忽略过渡。只有 html 元素才有 class。
      return;
    } else {
      // 执行实际的过渡。doTrans 函数中会将 this._t 变更为当前过渡的取消函数。
      await doTrans(this, isEnter, el);
    }
  }

  __enter(isFirst?: boolean) {
    return this.__trans(true, isFirst);
  }

  __leave(isFirst?: boolean) {
    return this.__trans(false, isFirst);
  }

  __destroy(removeDOM?: boolean) {
    this._t?.(); // 取消正在进行中的过渡动画
    return super.__destroy(removeDOM);
  }
}
