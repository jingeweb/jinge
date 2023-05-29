import { createElement, createTextNode } from '../util';
// import { i18n as i18nService } from './i18n';
import { Component, __ } from './component';

export function emptyRenderFn(component: Component): Node[] {
  const el = document.createComment('empty');
  component[__].rootNodes.push(el);
  return [el];
}

export function errorRenderFn(component: Component, message: string): Node[] {
  const el = createElement('code', {
    style: 'color: red !important;',
  });
  el.innerHTML = message;
  component[__].rootNodes.push(el);
  return [el];
}

export function textRenderFn(component: Component, txtContent: unknown): Node {
  const el = createTextNode(txtContent);
  component[__].rootNodes.push(el);
  return el;
}
