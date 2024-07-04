import { createElement, createTextNode } from '../util';
import { ROOT_NODES } from './common';
import type { Component } from './component';

export function emptyRenderFn(component: Component): Node[] {
  const el = document.createComment('empty');
  component[ROOT_NODES].push(el);
  return [el];
}

export function errorRenderFn(component: Component, message: string): Node[] {
  const el = createElement('code', {
    style: 'color: red !important;',
  });
  el.innerHTML = message;
  component[ROOT_NODES].push(el);
  return [el];
}

export function textRenderFn(component: Component, txtContent: unknown): Node {
  const el = createTextNode(txtContent);
  component[ROOT_NODES].push(el);
  return el;
}
