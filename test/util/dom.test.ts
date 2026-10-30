import {
  appendChildren,
  createComment,
  createEle,
  createEleA,
  createFragment,
  createSVGEle,
  createSVGEleA,
  createTextNode,
  insertAfter,
  insertBefore,
  registerEvent,
  removeAttribute,
  replaceChildren,
  setAttribute,
  setClassAttribute,
  setStyleAttribute,
  setTextContent,
} from '../../src/util';
import { jestApi, setupRuntimeTests } from '../_helper';
setupRuntimeTests();
test.each([
  [null, 'null'],
  [undefined, 'undefined'],
  [false, 'false'],
  [0, '0'],
  [{ name: 'a' }, '{"name":"a"}'],
  [new Error('oops'), 'oops'],
])('setTextContent converts %p to text', (value, text) => {
  const node = createTextNode();
  setTextContent(node, value);
  expect(node.textContent).toBe(text);
});
test('HTML factories attach attributes, strings and existing nodes', () => {
  const span = createEle('span', 'child');
  const div = createEleA('div', { id: 'root', title: undefined }, 'prefix', span);
  expect(div.outerHTML).toBe('<div id="root">prefix<span>child</span></div>');
  expect(div.lastChild).toBe(span);
});
test('SVG factories preserve namespaces and attributes', () => {
  const path = createSVGEleA('path', { d: 'M0 0' });
  const svg = createSVGEle('svg', path);
  expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
  expect(path.namespaceURI).toBe(svg.namespaceURI);
  expect(path.getAttribute('d')).toBe('M0 0');
});
test('attribute helpers set maps and remove null or undefined values', () => {
  const node = createEle('div');
  setAttribute(node, 'title', 'hello');
  setAttribute(node, 'title', null);
  expect(node.hasAttribute('title')).toBe(false);
  setAttribute(node, { id: 'x', title: 'y' } as unknown as string, undefined);
  expect(node.id).toBe('x');
  removeAttribute(node, { id: true, title: true } as unknown as string);
  expect(node.attributes).toHaveLength(0);
  setClassAttribute(node, 'a b');
  expect(node.className).toBe('a b');
  setClassAttribute(node, '');
  expect(node.hasAttribute('class')).toBe(false);
  setStyleAttribute(node, 'color: red');
  expect((node as HTMLElement).style.color).toBe('red');
  setStyleAttribute(node);
  expect(node.hasAttribute('style')).toBe(false);
});
test('fragment, append, replace and insertion preserve node ordering', () => {
  const parent = createEle('div');
  const old = createComment('old');
  appendChildren(parent, [old]);
  const first = createTextNode('a');
  const last = createTextNode('c');
  replaceChildren(parent, [first, last], old);
  insertAfter(parent, createTextNode('b'), first);
  insertBefore(parent, createTextNode('d'));
  expect(parent.textContent).toBe('abcd');
  const fragment = createFragment(['e', createTextNode('f')]);
  parent.append(fragment);
  expect(parent.textContent).toBe('abcdef');
  expect(fragment.childNodes).toHaveLength(0);
});
test('registered bubbling events can be cancelled without removing other handlers', () => {
  const button = document.createElement('button');
  const a = jestApi.fn();
  const b = jestApi.fn();
  const cancel = registerEvent(button, 'click', a);
  registerEvent(button, 'click', b);
  button.click();
  cancel();
  button.click();
  expect(a).toHaveBeenCalledTimes(1);
  expect(b).toHaveBeenCalledTimes(2);
});

test('appending one string creates a text node and empty attribute names are ignored', () => {
  const node = document.createElement('div');
  appendChildren(node, ['text']);
  expect(node.firstChild?.nodeType).toBe(Node.TEXT_NODE);
  setAttribute(node, '', 'ignored');
  removeAttribute(node, '');
  expect(node.attributes).toHaveLength(0);
});
test('SVG factories also accept existing child nodes', () => {
  const text = createSVGEle('text');
  const group = createSVGEleA('g', { id: 'group' }, text);
  expect(group.firstChild).toBe(text);
});
test('touch listeners use passive bubbling options by default', () => {
  const node = document.createElement('div');
  const register = jestApi.spyOn(node, 'addEventListener');
  const cancel = registerEvent(node, 'touchstart', () => {});
  expect(register).toHaveBeenCalledWith('touchstart', expect.any(Function), {
    capture: false,
    passive: true,
  });
  cancel();
});
