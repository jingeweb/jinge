import { ROOT_NODES, UPDATE_RENDER } from '../../core';
import type { JNode } from '../../jsx';
import { createComment } from '../../util';
import { vmWatch } from '../../vm';

export interface TransitionCallbacks {
  onAfterEnter?(el: HTMLElement): void;
  onEnterCancelled?(): void;
  onAfterLeave?(el: HTMLElement): void;
  onLeaveCancelled?(): void;
}

export type TransitionInnerProps = {
  destroyAfterLeave?: boolean;
  isEnter?: boolean;
  enter?: string;
  leave?: string;
  enterActive?: string;
  leaveActive?: string;
  appear?: boolean;
};

export type TransitionProps = TransitionInnerProps & TransitionCallbacks;

enum TState {
  Entering,
  Entered,
  Leaving,
  Leaved,
}

const STATE = Symbol();
const CLSTOKENS = Symbol();
const MOUNTED = Symbol();
const REAL_ENTER = Symbol('realEnter');
function parseCls(cls?: string) {
  return cls ? cls.trim().split(/\s+/) : [];
}
export class Transition extends Component<TransitionProps, JNode> {
  [MOUNTED]: boolean;
  [STATE]: TState;
  [REAL_ENTER]: boolean;
  [CLSTOKENS]: string[][];
  constructor(attrs: TransitionProps) {
    super();

    this[MOUNTED] = !attrs.destroyAfterLeave || (attrs.appear ? !attrs.isEnter : !!attrs.isEnter);
    this[REAL_ENTER] = attrs.appear ? !attrs.isEnter : !!attrs.isEnter;
    this[STATE] = (attrs.appear ? !attrs.isEnter : !!attrs.isEnter)
      ? TState.Entered
      : TState.Leaved;
    // 提前将四种状态的 class 字符串转成 Element.classList 支持的 tokens
    this[CLSTOKENS] = [
      parseCls(attrs.enter), // enter 进入后的 class
      parseCls(attrs.enterActive), // enter active 开始进入（激活）的 class
      parseCls(attrs.leave), // leave 离开后的 class
      parseCls(attrs.leaveActive),
    ];
    vmWatch(attrs, 'isEnter', (v) => {
      if (!attrs.destroyAfterLeave) {
        this[REAL_ENTER] = !!v;
        return; // important to return;
      }
      if (v) {
        if (this[STATE] === TState.Leaving) {
          attrs.onLeaveCancelled?.();
          this[STATE] = TState.Entering;
          this[REAL_ENTER] = true;
        } else {
          this[MOUNTED] = true;
        }
      } else {
        if (this[STATE] === TState.Entering || this[STATE] === TState.Entered) {
          if (this[STATE] === TState.Entering) {
            attrs.onEnterCancelled?.();
          }
          this[STATE] = TState.Leaving;
          this[REAL_ENTER] = false;
        }
      }
    });
  }

  [UPDATE_RENDER]() {
    if (this[REAL_ENTER]) {
      this[STATE] = TState.Entering;
    }
  }

  render() {
    if (!this[MOUNTED]) {
      this[ROOT_NODES] = [createComment('transition-leaved')];
      return this[ROOT_NODES];
    } else {
      const nodes = super.render() as HTMLElement[];
      const cls = this[REAL_ENTER] ? this[CLSTOKENS][0] : this[CLSTOKENS][2];
      nodes.forEach((n) => {
        n.classList.add(...cls);
      });
      return nodes;
    }
  }
}
