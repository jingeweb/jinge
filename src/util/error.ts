const Errs = {
  'ctx-key-exist':
    'Contenxt with key: {0} is exist. Pass third argument forceOverride=true to override it.',
  'dup-render': 'component has already been rendered.',
  'setctx-after-render':
    "Can't setContext after component has been rendered. Try put setContext code into constructor.",
  'bind-attr-not-pub-prop': 'attrName of __bindAttr() requires public property.',
  'switch-miss-slot': 'Slot {0} or [DEFAULT_SLOT] of <Switch /> not found.',
  'hook-miss-component': 'Unexpect error, global component not found.',
  'transition-require-element':
    'Children of <Transition /> component must be one and only one html element',
  'assert-failed': 'Assert failed, contact developer to report this error.',
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
