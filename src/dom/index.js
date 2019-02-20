import {
  isString,
  isArray
} from '../util';

export function getParent($ele) {
  return $ele.parentNode;
}

export function setText($element, text) {
  $element.textContent = text;
}

export function setAttribute($ele, attrName, attrValue) {
  $ele.setAttribute(attrName, attrValue);
}

export function removeAttribute($ele, attrName) {
  return $ele.removeAttribute(attrName);
}

export function setInputValue($inputOrTextarea, value) {
  $inputOrTextarea.value = value;
}

export function createElement(tag, attrs, ...children) {
  const $e = document.createElement(tag);
  if (attrs) for(const an in attrs) {
    setAttribute($e, an, attrs[an]);
  }
  children.forEach(child => appendChild($e, child));
  return $e;
}

export function createElementWithoutAttrs(tag, ...children) {
  return createElement(tag, null, ...children);
}

export function createFragment(children) {
  const $f = document.createDocumentFragment();
  if (children) children.forEach(c => appendChild($f, c));
  return $f;
}

export function createTextNode(text) {
  return document.createTextNode(text);
}

export function createElementWithChild(tag, attrs, child) {
  const $e = createElement(tag, attrs);
  appendChild($e, child);
  return $e;
}

let DEBUG_INC = 0;
export function createComment(data) {
  return document.createComment(data + (DEBUG_INC++).toString());
}

function prepareNewNode(newNode) {
  if (!isArray(newNode)) return newNode;
  if (newNode.length === 0) return null;
  else if (newNode.length === 1) return newNode[0];
  else {
    return createFragment(newNode);
  }
}

export function replaceChild($parent, newNode, oldNode) {
  if (!(newNode = prepareNewNode(newNode))) {
    return;
  }
  $parent.replaceChild(newNode, oldNode);
}

export function insertBefore($parent, newNode, referenceNode) {
  if (!(newNode = prepareNewNode(newNode))) {
    return;
  }
  $parent.insertBefore(newNode, referenceNode);
}

export function insertAfter($parent, newNode, referenceNode) {
  if (!(newNode = prepareNewNode(newNode))) {
    return;
  }
  const rn = referenceNode.nextSibling;
  if (!rn) {
    appendChild($parent, newNode);
  } else {
    insertBefore($parent, newNode, rn);
  }
}

export function removeChild($parent, $child) {
  $parent.removeChild($child);
}

export function appendChild($parent, ...children) {
  children.forEach(ch => {
    if (isArray(ch)) {
      return ch.forEach(cc => appendChild($parent, cc));
    }
    if (isString(ch)) {
      ch = createTextNode(ch);
    }
    $parent.appendChild(ch);
  });
}

export function hasClass($ele, className) {
  return $ele.classList.contains(className);
}

export function toggleClass($ele, ...args) {
  return $ele.classList.toggle(...args);
}
export function addClass($ele, className) {
  return toggleClass($ele, className, true);
}

export function removeClass($ele, className) {
  return toggleClass($ele, className, false);
}

export function addEvent($element, eventName, handler, capture = false) {
  $element.addEventListener(eventName, handler, capture);
}

export function removeEvent($element, eventName, handler) {
  $element.removeEventListener(eventName, handler);
}