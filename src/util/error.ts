const Errs = {
  'watch-not-vm': 'watch() or watchPath() requires view-model, use vm() to wrap object.',
  'array-item-not-vm': 'argument passed to Array.{0} must be ViewModel if the array is ViewModel.',
  'pub-prop-not-vm':
    "value of ViewModel's public property must also be ViewModel, use vm() to wrap it.",
  'ctx-key-exist':
    'Contenxt with key: {0} is exist. Pass third argument forceOverride=true to override it.',
  'dup-render': 'component has already been rendered.',
  'setctx-after-render':
    "Can't setContext after component has been rendered. Try put setContext code into constructor.",
  'bind-attr-not-pub-prop': 'attrName of __bindAttr() requires public property.',
  'bind-attr-not-vm': 'attrs of __bindAttr() requires view-model, use vm() to wrap object.',
  'switch-miss-slot': 'Slot {0} or [DEFAULT_SLOT] of <Switch /> not found.',
};

export function throwErr(id: keyof typeof Errs, ...args: unknown[]): never {
  if (import.meta.env.MODE === 'production') {
    throw new Error(
      `Production min error: ${id}. Use development mode or visit https://[todo]/error/${id} for more detail.`,
    );
  } else {
    let err = Errs[id];
    args.forEach((arg, i) => {
      err = err.replace(new RegExp(`\\{${i}\\}`, 'g'), `${arg}`);
    });
    throw new Error(`${err} Visit https://[todo]/error/${id} for more detail.`);
  }
}
