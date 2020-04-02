import {
  createElement,
  createTextNode
} from '../util';
import {
  i18n as i18nService
} from './i18n';
import {
  Component, __
} from './component';

export function emptyRenderFn(component: Component): Node[] {
  const el = document.createComment('empty');
  component[__].rootNodes.push(el);
  return [el];
}

export function errorRenderFn(component: Component): Node {
  const el = createElement('span', {
    style: 'color: red !important;'
  });
  el.textContent = 'template parsing failed! please check webpack log.';
  component[__].rootNodes.push(el);
  return el;
}

export function textRenderFn(component: Component, txtContent: unknown): Node {
  const el = createTextNode(txtContent);
  component[__].rootNodes.push(el);
  return el;
}

export function i18nRenderFn(component: Component, key: string, isRoot = false): Node {
  const el = createTextNode();
  const fn = (): void => {
    el.textContent = i18nService.__t(key);
  };
  fn();
  component.__i18nWatch(fn);
  isRoot && component[__].rootNodes.push(el);
  return el;
}
