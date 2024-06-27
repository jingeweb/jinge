import type { AnyFn, AnyObj, CLASSNAME } from 'src/util';
import type { ListenerOptions } from './emitter';
import type { RenderFn } from './common';
import { CONTEXT, SLOTS, __ } from './common';

export interface CompilerAttrs {
  [CONTEXT]?: Record<string, unknown>;
  [SLOTS]?: Record<string, RenderFn>;
  // listeners?: Record<
  //   string,
  //   {
  //     fn: AnyFn;
  //     opts?: ListenerOptions;
  //   }
  // >;
}

export function newEmptyAttrs(defaultSlotFn: RenderFn, context?: CompilerAttrs[typeof CONTEXT]) {
  return {
    [__]: {
      [CONTEXT]: context,
      [SLOTS]: {
        default: defaultSlotFn,
      },
    },
  };
}
