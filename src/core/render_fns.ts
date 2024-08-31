import { createEleA, createTextNode } from '../util';
import { ROOT_NODES } from './common';
import type { ComponentHost } from './component';

export function emptyRenderFn(component: ComponentHost): Node[] {
  const el = document.createComment('empty');
  component[ROOT_NODES].push(el);
  return [el];
}

export function errorRenderFn(component: ComponentHost, message: string): Node[] {
  const el = createEleA('code', {
    style: 'color: red !important;',
  });
  el.innerHTML = message;
  component[ROOT_NODES].push(el);
  return [el];
}

export function textRenderFn(component: ComponentHost, txtContent: unknown): Node {
  const el = createTextNode(txtContent);
  component[ROOT_NODES].push(el);
  return el;
}
