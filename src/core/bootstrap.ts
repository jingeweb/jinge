import { renderToDOM, type Component } from './component';

export function bootstrap<A extends object, C extends Component<A>>(
  ComponentClazz: {
    new (attrs: A): C;
  },
  dom: HTMLElement,
  attrs?: A,
) {
  const app = new ComponentClazz(attrs as A);
  renderToDOM(app, dom, dom !== document.body);
  return app;
}
