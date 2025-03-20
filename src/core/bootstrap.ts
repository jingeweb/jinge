import { ComponentHost, handleRenderDone, renderFunctionComponent } from './component';
import { appendChildren, replaceChildren } from '../util';
import type { FC } from '../jsx';
import type { Context } from './common';
import type { RefValue } from './ref';

export type BootstrapReturn<T extends FC> = ComponentHost & RefValue<Parameters<T>[0]['ref']>;

export function bootstrap<T extends FC>(
  fc: T,
  dom: HTMLElement,
  props?: Omit<Parameters<T>[0], 'children'>,
  context?: Context,
) {
  const host = new ComponentHost(context);
  const nodes = renderFunctionComponent(host, fc, props ?? {});
  if (dom !== document.body) {
    replaceChildren(dom.parentNode as HTMLElement, nodes, dom);
  } else {
    appendChildren(dom, nodes);
  }
  handleRenderDone(host);
  return host as unknown as BootstrapReturn<T>;
}
