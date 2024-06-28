import { proxyAttributes } from 'src/vm';
import type { Component } from './component';
import { RENDER_TO_DOM } from './common';

export function bootstrap<
  T extends {
    new (attrs: object): Component;
  },
>(ComponentClazz: T, dom: HTMLElement, attrs?: ConstructorParameters<T>[0]): InstanceType<T> {
  const app = new ComponentClazz(attrs ? proxyAttributes(attrs) : {});
  app[RENDER_TO_DOM](dom, dom !== document.body);
  return app as InstanceType<T>;
}
