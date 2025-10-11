import {
  CONTEXT,
  ComponentHost,
  ROOT_NODES,
  addUnmountFn,
  renderFunctionComponent,
  replaceRenderFunctionComponent,
} from '../core';

import type { FC } from '../jsx';
import { createComment } from '../util';
import { vmWatch } from '../vm';

export function Dynamic<T extends FC>(
  props: {
    fc?: T;
  } & Parameters<T>[0],
  host: ComponentHost,
) {
  const el = new ComponentHost(host[CONTEXT]);
  host[ROOT_NODES].push(el);

  function update(fc?: FC) {
    replaceRenderFunctionComponent(
      el,
      fc,
      host[CONTEXT],
      props,
      'dynamic:null',
    );
  }
  addUnmountFn(host, vmWatch(props, 'fc', update));

  function render(fc?: FC) {
    if (!fc) {
      el[ROOT_NODES].push(createComment('dynamic:null'));
      return el[ROOT_NODES];
    } else {
      return renderFunctionComponent(el, fc, props);
    }
  }

  return render(props.fc);
}
