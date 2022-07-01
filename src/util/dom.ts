import { isString, isUndefined, isObject, isArray, isNumber } from './type';
import { DeregisterFn } from './common';

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

function _createEl($el: Element, attrs: Record<string, unknown>, children: (Node | string)[]) {
  if (attrs) {
    for (const an in attrs) {
      if (an && !isUndefined(attrs[an])) {
        setAttribute($el, an, attrs[an]);
      }
    }
  }
  children.length > 0 && appendChildren($el, children);
  return $el;
}

export function createElement(tag: string, attrs: Record<string, unknown>, ...children: (Node | string)[]) {
  return _createEl(document.createElement(tag), attrs, children);
}

export function createElementWithoutAttrs(tag: string, ...children: (Node | string)[]) {
  return createElement(tag, null, ...children);
}

export function createSVGElement(tag: string, attrs: Record<string, unknown>, ...children: Node[]) {
  return _createEl(document.createElementNS('http://www.w3.org/2000/svg', tag), attrs, children);
}

export function createSVGElementWithoutAttrs(tag: string, ...children: Node[]) {
  return createSVGElement(tag, null, ...children);
}

export function createElementWithChild(tag: string, attrs: Record<string, unknown>, child: Node | string) {
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

export function removeEvent($element: Element | Window | Document, eventName: string, handler: EventListener): void {
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
): DeregisterFn {
  addEvent($element, eventName, handler, capture);
  return function deregister(): void {
    removeEvent($element, eventName, handler);
  };
}

export type CLASSNAME = string | Record<string, boolean> | CLASSNAME[];

export function class2str(className: CLASSNAME) {
  if (!className) return className as string;
  if (isString(className)) {
    return className.trim();
  }
  if (isArray(className)) {
    const clist: string[] = [];
    className.forEach((cn) => {
      const seg = class2str(cn);
      seg && clist.push(seg);
    });
    return clist.join(' ').trim();
  }
  return Object.keys(className)
    .filter((k) => !!className[k])
    .join(' ')
    .trim();
}

export function setClassAttribute($ele: Element, className: CLASSNAME) {
  className = class2str(className);
  if (!className) $ele.removeAttribute('class');
  else $ele.setAttribute('class', className);
}

const UNITLESS = new Set([
  'box-flex',
  'box-flex-group',
  'column-count',
  'flex',
  'flex-grow',
  'flex-positive',
  'flex-shrink',
  'flex-negative',
  'font-weight',
  'line-clamp',
  'line-height',
  'opacity',
  'order',
  'orphans',
  'tab-size',
  'widows',
  'z-index',
  'zoom',
  'fill-opacity',
  'stroke-dashoffset',
  'stroke-opacity',
  'stroke-width',
]);
export function style2str(style: string | Record<string, string | number | boolean>) {
  if (!style) return style as string;
  if (isString(style)) return style.trim();
  if (Array.isArray(style)) {
    const slist: string[] = [];
    style.forEach((sty) => {
      const seg = style2str(sty);
      seg && slist.push(seg);
    });
    return slist.join('').trim();
  }
  const segs: string[] = [];
  Object.keys(style).forEach((k) => {
    let v = style[k];
    if (!v && v !== 0) return;
    k = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    if (isNumber(v) && !UNITLESS.has(k)) {
      v = `${v}px`;
    } else {
      v = v.toString();
    }
    segs.push(`${k}:${v};`);
  });
  return segs.join('').trim();
}

export function setStyleAttribute($ele: Element, style: string | Record<string, string | number>) {
  style = style2str(style);
  if (!style) $ele.removeAttribute('style');
  else $ele.setAttribute('style', style);
}
