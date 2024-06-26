import { AnyFn, CLASSNAME } from "src/util";
import { RenderFn } from "./component";
import { ListenerOptions } from "./emitter";
import { proxyAttributes } from "src/vm_v2";

export interface CompilerAttributes {
  context?: Record<string, unknown>;
  slots?: Record<string, RenderFn>;
  listeners?: Record<string, {
    fn: AnyFn;
    opts?: ListenerOptions
  }>;
}

 

export type Attributes<Attrs extends object> = {
  class?: CLASSNAME;
  style?: string | Record<string, string | number>;
} & Attrs;

export { wrapAttrs as attrs };
