import { Component } from './component';

export function bootstrap<T extends typeof Component & { create(attrs: unknown): Component }, Props>(
  ComponentClazz: T,
  dom: HTMLElement,
  attrs?: Props,
): InstanceType<T> {
  const app = ComponentClazz.create(attrs);
  app.__renderToDOM(dom, dom !== document.body);
  return app as InstanceType<T>;
}
