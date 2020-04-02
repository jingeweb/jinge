import {
  Component,
  ComponentAttributes
} from './component';

export function bootstrap<T extends Component & { create(attrs: object): T }>(ComponentClazz: T, dom: HTMLElement, attrs?: ComponentAttributes): T {
  const app = ComponentClazz.create(attrs);
  app.__renderToDOM(
    dom, dom !== document.body
  );
  return app;
}
