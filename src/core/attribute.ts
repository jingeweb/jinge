import type { AnyFn, AnyObj, CLASSNAME } from 'src/util';
import type { ListenerOptions } from './emitter';
import type { CONTEXT, RenderFn, SLOTS, __ } from './common';

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

export interface BaseAttrs {
  class?: CLASSNAME;
  style?: string | Record<string, string | number>;
  [__]?: CompilerAttrs;
}

export type Attrs<A extends AnyObj> = A & BaseAttrs;
