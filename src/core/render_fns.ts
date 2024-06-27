import { createElement, createTextNode } from '../util';
import { ROOT_NODES, __ } from './common';
import type { Component } from './component';
// import { i18n as i18nService } from './i18n';

export function emptyRenderFn(component: Component): Node[] {
  const el = document.createComment('empty');
  component[__][ROOT_NODES].push(el);
  return [el];
}

export function errorRenderFn(component: Component, message: string): Node[] {
  const el = createElement('code', {
    style: 'color: red !important;',
  });
  el.innerHTML = message;
  component[__][ROOT_NODES].push(el);
  return [el];
}

export function textRenderFn(component: Component, txtContent: unknown): Node {
  const el = createTextNode(txtContent);
  component[__][ROOT_NODES].push(el);
  return el;
}
