interface CompilerAttributes {
  context?: Record<string, unknown>;
  slots?: Record<string, RenderFn>;
  listeners?: Record<string, MessengerHandler>;
}

export type ComponentAttributes = ViewModelObject & {
  class?: CLASSNAME;
  style?: string | Record<string, string | number>;
  [__]?: CompilerAttributes;
};

export type Attributes<Props = Record<string, unknown>> = ComponentAttributes & Props;

function wrapAttrs<Props extends Record<string, unknown>>(
  target: Props & {
    [__]?: CompilerAttributes;
  },
): ViewModelObject & Props {
  if (!isObject(target) || isArray(target)) {
    throw new Error('attrs() traget must be plain object.');
  }
  return createAttributes(target);
}
export { wrapAttrs as attrs };
