import type { Component } from './component';
import { RENDER_TO_DOM } from './common';

export function bootstrap<A extends object, C extends Component>(
  ComponentClazz: {
    new (attrs: A): C;
  },
  dom: HTMLElement,
  attrs?: A,
) {
  const app = new ComponentClazz(attrs as A);
  app[RENDER_TO_DOM](dom, dom !== document.body);
  return app;
}
