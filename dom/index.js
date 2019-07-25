import {
  isString,
  isArray,
  isUndefined
} from '../util';

export function getParent($ele) {
  return $ele.parentNode;
}

export function setText($element, text) {
  $element.textContent = text;
}

export function setAttribute($ele, attrName, attrValue) {
  if (!attrName) return;
  if (isUndefined(attrValue)) {
    removeAttribute($ele, attrName);
  } else {
    $ele.setAttribute(attrName, attrValue);
  }
}

export function removeAttribute($ele, attrName) {
  return $ele.removeAttribute(attrName);
}

export function setInputValue($inputOrTextarea, value) {
  $inputOrTextarea.value = value;
}

function _createEl($el, attrs, children) {
  if (attrs) {
    for (const an in attrs) {
      if (an && !isUndefined(attrs[an])) {
        setAttribute($el, an, attrs[an]);
      }
    }
  }
  children.forEach(child => appendChild($el, child));
  return $el;
}
export function createElement(tag, attrs, ...children) {
  return _createEl(
    document.createElement(tag),
    attrs, children
  );
}

export function createElementWithoutAttrs(tag, ...children) {
  return createElement(tag, null, ...children);
}

export function createSVGElement(tag, attrs, ...children) {
  return _createEl(
    document.createElementNS('http://www.w3.org/2000/svg', tag),
    attrs, children
  );
}

export function createSVGElementWithoutAttrs(tag, ...children) {
  return createSVGElement(tag, null, ...children);
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

export function createComment(data) {
  return document.createComment(data);
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

export function replaceClass($ele, oldClass, newClass) {
  return $ele.classList.replace(oldClass, newClass);
}

export function addEvent($element, eventName, handler, capture = false) {
  $element.addEventListener(eventName, handler, capture);
}

export function removeEvent($element, eventName, handler) {
  $element.removeEventListener(eventName, handler);
}

export function getComputedStyle(el, p) {
  return window.getComputedStyle(el, p);
}

export function getCSPropertyValue(cst, prop) {
  return cst.getPropertyValue(prop);
}
