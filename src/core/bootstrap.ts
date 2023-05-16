import { Component } from './component';

export async function bootstrap<T extends typeof Component & { create(attrs: unknown): Component }, Props>(
  ComponentClazz: T,
  dom: HTMLElement,
  attrs?: Props,
): Promise<InstanceType<T>> {
  const app = ComponentClazz.create(attrs);
  await app.__renderToDOM(dom, dom !== document.body);
  return app as InstanceType<T>;
}
