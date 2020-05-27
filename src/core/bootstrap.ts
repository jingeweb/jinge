import {
  Component,
  ComponentAttributes
} from './component';

export function bootstrap<T extends (typeof Component) & { create(attrs: unknown): Component }>(ComponentClazz: T, dom: HTMLElement, attrs?: ComponentAttributes): InstanceType<T> {
  const app = ComponentClazz.create(attrs);
  app.__renderToDOM(
    dom, dom !== document.body
  );
  return app as InstanceType<T>;
}
