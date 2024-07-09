import { isString, isUndefined, isObject } from './type';

export function setText($element: Node, text: unknown): void {
  if (isObject(text)) {
    text = JSON.stringify(text);
  }
  $element.textContent = text as string;
}

export function createTextNode(text: unknown = ''): Text {
  return document.createTextNode(isObject(text) ? JSON.stringify(text) : (text as string));
}

export function createFragment(children?: (Node | string)[]): DocumentFragment {
  const f = document.createDocumentFragment();
  children?.forEach((n) => {
    f.appendChild(isString(n) ? document.createTextNode(n as string) : (n as Node));
  });
  return f;
}

export function appendChildren($parent: Node, children: (Node | string)[]): void {
  $parent.appendChild(
    children.length > 1
      ? createFragment(children)
      : isString(children[0])
        ? createTextNode(children[0] as string)
        : (children[0] as Node),
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
  children?.length && appendChildren($el, children);
  return $el;
}

export function createElement(
  tag: string,
  attrs: Record<string, unknown> | undefined,
  ...children: (Node | string)[]
) {
  return _createEl(document.createElement(tag), attrs, children);
}

export function createElementWithoutAttrs(tag: string, ...children: (Node | string)[]) {
  return _createEl(document.createElement(tag), undefined, children);
}

export function createSVGElement(
  tag: string,
  attrs: Record<string, unknown> | undefined,
  ...children: Node[]
) {
  return _createEl(document.createElementNS('http://www.w3.org/2000/svg', tag), attrs, children);
}

export function createSVGElementWithoutAttrs(tag: string, ...children: Node[]) {
  return createSVGElement(tag, undefined, ...children);
}

export function createElementWithChild(
  tag: string,
  attrs: Record<string, unknown>,
  child: Node | string,
) {
  const $e = createElement(tag, attrs);
  $e.appendChild(isString(child) ? createTextNode(child) : (child as Node));
  return $e;
}

export function insertAfter($parent: Node, newNode: Node, referenceNode: Node): void {
  const rn = referenceNode.nextSibling;
  if (!rn) {
    $parent.appendChild(newNode);
  } else {
    $parent.insertBefore(newNode, rn);
  }
}

export function addEvent(
  $element: Element | Window | Document,
  eventName: string,
  handler: EventListener,
  capture?: boolean | AddEventListenerOptions,
): void {
  isUndefined(capture) &&
    (capture = eventName.startsWith('touch')
      ? {
          capture: false,
          passive: true,
        }
      : false);
  $element.addEventListener(eventName, handler, capture);
}

export function removeEvent(
  $element: Element | Window | Document,
  eventName: string,
  handler: EventListener,
): void {
  $element.removeEventListener(eventName, handler);
}

/**
 * Add event to DOM element, similar as addEventListener,
 * but return deregister function which will call removeEventListener.
 *
 * @returns {Function} deregister function which will removeEventListener
 */
export function registerEvent(
  $element: Element | Window | Document,
  eventName: string,
  handler: EventListener,
  capture?: boolean | AddEventListenerOptions,
) {
  addEvent($element, eventName, handler, capture);
  return () => {
    removeEvent($element, eventName, handler);
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
