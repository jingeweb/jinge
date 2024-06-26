import { proxyAttributes } from 'src/vm_v2';
import type { Component } from './component';

export function bootstrap<T extends typeof Component<any, any>>(
  ComponentClazz: T,
  dom: HTMLElement,
  attrs?: ConstructorParameters<T>[0],
): InstanceType<T> {
  const app = new ComponentClazz(proxyAttributes(attrs ?? {}));
  app.__renderToDOM(dom, dom !== document.body);
  return app as InstanceType<T>;
}
