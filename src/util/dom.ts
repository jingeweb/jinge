/* eslint-disable @typescript-eslint/no-explicit-any */
import { isObject, isUndefined } from './type';

function toText(v: unknown) {
  if (v === null) return 'null';
  else if (v === undefined) return 'undefined';
  else if (v instanceof Error) return v.message;
  else if (isObject(v)) return JSON.stringify(v);
  else return (v as { toString: () => string }).toString();
}

export function setTextContent($ele: Node, v: unknown) {
  $ele.textContent = toText(v);
}

export function createTextNode(text = ''): Text {
  return document.createTextNode(text);
}

export function createFragment(children?: (Node | string)[]): DocumentFragment {
  const f = document.createDocumentFragment();
  children?.forEach((n) => {
    f.appendChild(n instanceof Node ? n : document.createTextNode(n as string));
  });
  return f;
}

export function createComment(cmt?: string) {
  return document.createComment(cmt ?? '');
}

export function appendChildren($parent: Node, children: (Node | string)[]): void {
  $parent.appendChild(
    children.length > 1
      ? createFragment(children)
      : children[0] instanceof Node
        ? children[0]
        : createTextNode(children[0] as string),
  );
}

export function replaceChildren($parent: Node, children: Node[], oldNode: Node): void {
  $parent.replaceChild(createFragment(children), oldNode);
}

export function removeAttribute($ele: Element, attrName: string): void {
  if (!attrName) return;
  if (isObject(attrName)) {
    for (const attrN in attrName as unknown as Record<string, unknown>) {
      removeAttribute($ele, attrN);
    }
    return;
  }
  return $ele.removeAttribute(attrName);
}

export function setAttribute($ele: Element, attrName: string, attrValue: unknown) {
  if (!attrName) return;
  if (isObject(attrName)) {
    for (const attrN in attrName as unknown as Record<string, unknown>) {
      setAttribute($ele, attrN, (attrName as unknown as Record<string, unknown>)[attrN]);
    }
    return;
  }
  if (isUndefined(attrValue) || attrValue === null) {
    removeAttribute($ele, attrName);
  } else {
    $ele.setAttribute(attrName, attrValue as string);
  }
}

function _createEl($el: Element, attrs?: Record<string, unknown>, children?: (Node | string)[]) {
  if (attrs) {
    for (const an in attrs) {
      if (an && !isUndefined(attrs[an])) {
        setAttribute($el, an, attrs[an]);
      }
    }
  }
  if (children?.length) appendChildren($el, children);
  return $el;
}

export function createEleA(
  tag: string,
  attrs: Record<string, unknown> | undefined,
  ...children: (Node | string)[]
) {
  return _createEl(document.createElement(tag), attrs, children);
}
export function createEle(tag: string, ...children: (Node | string)[]) {
  return createEleA(tag, undefined, ...children);
}
export function createSVGEleA(
  tag: string,
  attrs: Record<string, unknown> | undefined,
  ...children: Node[]
) {
  return _createEl(document.createElementNS('http://www.w3.org/2000/svg', tag), attrs, children);
}
export function createSVGEle(tag: string, ...children: Node[]) {
  return createSVGEleA(tag, undefined, ...children);
}

export function insertAfter($parent: Node, newNode: Node, referenceNode?: Node | null) {
  $parent.insertBefore(newNode, referenceNode ? referenceNode.nextSibling : null);
}

export function insertBefore($parent: Node, newNode: Node, referenceNode?: Node | null) {
  $parent.insertBefore(newNode, referenceNode ?? null);
}

export type EventListener<M, E extends keyof M> = (evt: M[E]) => void;

export function addEvent<E extends keyof WindowEventMap>(
  $element: Window,
  eventName: E,
  handler: EventListener<WindowEventMap, E>,
  capture?: boolean | AddEventListenerOptions,
): void;
export function addEvent<E extends keyof DocumentEventMap>(
  $element: Document,
  eventName: E,
  handler: EventListener<DocumentEventMap, E>,
  capture?: boolean | AddEventListenerOptions,
): void;
export function addEvent<E extends keyof HTMLElementEventMap>(
  $element: Element,
  eventName: E,
  handler: EventListener<HTMLElementEventMap, E>,
  capture?: boolean | AddEventListenerOptions,
): void;
export function addEvent(
  $element: Element | Window | Document,
  eventName: any,
  handler: any,
  capture?: boolean | AddEventListenerOptions,
) {
  if (isUndefined(capture)) {
    capture = eventName.startsWith('touch')
      ? {
          capture: false,
          passive: true,
        }
      : false;
  }

  $element.addEventListener(eventName, handler, capture);
}

export function removeEvent<E extends keyof WindowEventMap>(
  $element: Window,
  eventName: E,
  handler: EventListener<WindowEventMap, E>,
): void;
export function removeEvent<E extends keyof DocumentEventMap>(
  $element: Document,
  eventName: E,
  handler: EventListener<DocumentEventMap, E>,
): void;
export function removeEvent<E extends keyof HTMLElementEventMap>(
  $element: Element,
  eventName: E,
  handler: EventListener<HTMLElementEventMap, E>,
): void;
export function removeEvent(
  $element: Element | Window | Document,
  eventName: any,
  handler: any,
): void {
  $element.removeEventListener(eventName, handler);
}

/**
 * Add event to DOM element, similar as addEventListener,
 * but return deregister function which will call removeEventListener.
 *
 * @returns {Function} deregister function which will removeEventListener
 */
export function registerEvent<E extends keyof WindowEventMap>(
  $element: Window,
  eventName: E,
  handler: EventListener<WindowEventMap, E>,
  capture?: boolean | AddEventListenerOptions,
): () => void;
export function registerEvent<E extends keyof DocumentEventMap>(
  $element: Document,
  eventName: E,
  handler: EventListener<DocumentEventMap, E>,
  capture?: boolean | AddEventListenerOptions,
): () => void;
export function registerEvent<E extends keyof HTMLElementEventMap>(
  $element: Element,
  eventName: E,
  handler: EventListener<DocumentEventMap, E>,
  capture?: boolean | AddEventListenerOptions,
): () => void;
export function registerEvent(
  $element: Element | Window | Document,
  eventName: any,
  handler: any,
  capture?: boolean | AddEventListenerOptions,
) {
  addEvent($element as any, eventName, handler, capture);
  return () => {
    removeEvent($element as any, eventName, handler);
  };
}

export function setClassAttribute($ele: Element, className?: string) {
  if (!className) $ele.removeAttribute('class');
  else $ele.setAttribute('class', className);
}

export function setStyleAttribute($ele: Element, style?: string) {
  if (!style) $ele.removeAttribute('style');
  else $ele.setAttribute('style', style);
}
