import { createTextNode, setTextContent } from '../util';
import { ROOT_NODES } from './common';
import type { ComponentHost } from './component';

export function textRenderFn(component: ComponentHost, txtContent: unknown): Node {
  const el = createTextNode('');
  setTextContent(el, txtContent);
  component[ROOT_NODES].push(el);
  return el;
}
