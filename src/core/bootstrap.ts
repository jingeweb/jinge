/* eslint-disable @typescript-eslint/no-explicit-any */

import { appendChildren, replaceChildren } from '../util';
import { ComponentHost, handleRenderDone, renderFunctionComponent } from './component';

export function bootstrap<C extends object = never>(FC: () => any, dom: HTMLElement): C;
export function bootstrap<A extends object = never, C extends object = never>(
  FC: (props: A) => any,
  dom: HTMLElement,
  props: A,
): C;
export function bootstrap(FC: any, dom: HTMLElement, props?: any) {
  const app = new ComponentHost();
  const nodes = renderFunctionComponent(app, FC, props);
  if (dom !== document.body) {
    replaceChildren(dom.parentNode as HTMLElement, nodes, dom);
  } else {
    appendChildren(dom, nodes);
  }
  handleRenderDone(app);
  return app;
}
