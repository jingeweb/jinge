import {
  isArray,
  arrayRemove,
  arrayPushIfNotExist,
  Symbol,
  startsWith
} from '../util';

export const VM_NOTIFY = Symbol('vm_notify');
export const VM_ON = Symbol('vm_on');
export const VM_OFF = Symbol('vm_off');
export const VM_CLEAR = Symbol('vm_clear');
export const VM_LISTENERS = Symbol('vm_listeners');
export const VM_LISTENERS_TM = Symbol('vm_listeners_tm');
export const VM_LISTENERS_HANDLERS = Symbol('vm_listeners_handlers');
export const VM_LISTENERS_CHILDREN = Symbol('vm_listeners_children');


function walkGetNode(vm, props, level = 0, create = false) {
  const end = props.length - 1;
  if (end < 0) return null;
  const propN = '' + props[level]; // force to string
  if (startsWith(propN, '_')) {
    console.error('WARN: property name startsWith char "_" is private/once-used property, ignored get/set listener.');
    return null;
  }
  let node = vm[propN];
  if (!node) {
    if (create) {
      // node can't have any prototype function.
      node = vm[propN] = Object.create(null);
      Object.assign(node, {
        [VM_LISTENERS_TM]: null,
        [VM_LISTENERS_HANDLERS]: [],
        [VM_LISTENERS_CHILDREN]: Object.create(null)
      });
    } else {
      return null;
    }
  }
  if (end === level) {
    return node;
  } else {
    return walkGetNode(node[VM_LISTENERS_CHILDREN], props, level + 1, create);
  }
}

export function vmAddListener(vm, prop, handler) {
  const props = isArray(prop) ? prop : prop.split('.');
  if (props.length === 0) return;
  const node = walkGetNode(vm[VM_LISTENERS], props, 0, true);
  arrayPushIfNotExist(node[VM_LISTENERS_HANDLERS], handler);
}

export function vmRemoveListener(vm, prop, handler) {
  const props = isArray(prop) ? prop : prop.split('.');
  if (props.length === 0) return;
  const node = walkGetNode(vm[VM_LISTENERS], props, 0, false);
  if (!node) return;
  if (!handler) node[VM_LISTENERS_HANDLERS].length = 0; // remove all
  else arrayRemove(node[VM_LISTENERS_HANDLERS], handler);
}

export function vmClearListener(vm) {
  function loopClear(node) {
    for(const prop in node) {
      const leaf = node[prop];
      if (!(VM_LISTENERS_TM in leaf)) return;
      if (leaf[VM_LISTENERS_TM]) {
        clearImm(leaf[VM_LISTENERS_TM]);
        leaf[VM_LISTENERS_TM] = null;
      }
      leaf[VM_LISTENERS_HANDLERS].length = 0;
      vmClearListener(leaf[VM_LISTENERS_CHILDREN]);
      leaf[VM_LISTENERS_CHILDREN] = null;
      node[prop] = null;
    }
  }
  loopClear(vm[VM_LISTENERS]);
}

export function vmAddMessengerInterface(vm) {
  if (VM_LISTENERS in vm) return;
  vm[VM_LISTENERS] = {};
  vm[VM_ON] = (prop, handler) => vmAddListener(vm, prop, handler);
  vm[VM_OFF] = (prop, handler) => vmRemoveListener(vm, prop, handler);
  vm[VM_NOTIFY] = prop => vmNotifyChanged(vm, prop);
  vm[VM_CLEAR] = () => vmClearListener(vm);
}

const setImm = window.setImmediate || window.setTimeout;
const clearImm = window.clearImmediate || window.clearTimeout;

function loopNotify(node) {
  if (node[VM_LISTENERS_TM]) {
    clearImm(node[VM_LISTENERS_TM]);
    node[VM_LISTENERS_TM] = null;
  }
  if (node[VM_LISTENERS_HANDLERS].length > 0) {
    node[VM_LISTENERS_TM] = setImm(() => {
      node[VM_LISTENERS_TM] = null;
      node[VM_LISTENERS_HANDLERS].forEach(handler => handler());
    });
  }
  const children = node[VM_LISTENERS_CHILDREN];
  for(const k in children) {
    loopNotify(children[k]);
  }
}
export function vmNotifyChanged(vm, prop) {
  const props = isArray(prop) ? prop : prop.split('.');
  if (props.length === 0) return;
  const node = walkGetNode(vm[VM_LISTENERS], props, 0, false);
  if (!node) return;
  loopNotify(node);
}
