import {
  isArray,
  arrayRemove,
  arrayPushIfNotExist,
  Symbol,
  startsWith,
  createEmptyObject,
  config
} from '../util';
import { isString } from 'util';

export const VM_NOTIFY = Symbol('vm_notify');
export const VM_ON = Symbol('vm_on');
export const VM_OFF = Symbol('vm_off');
export const VM_CLEAR = Symbol('vm_clear');
export const VM_LISTENERS_STAR = Symbol('*');
export const VM_LISTENERS_DBSTAR = Symbol('**');
export const VM_LISTENERS = Symbol('vm_listeners');
export const VM_LISTENERS_ID = Symbol('vm_listenrs_id');
export const VM_LISTENERS_PARENT = Symbol('vm_listeners_parent');
export const VM_LISTENERS_TM = Symbol('vm_listeners_tm');
export const VM_LISTENERS_HANDLERS = Symbol('vm_listeners_handlers');

function loopCreateNode(vm, props, level = 0) {
  let propN = props[level];
  if (propN !== VM_LISTENERS_STAR && propN !== VM_LISTENERS_DBSTAR && !isString(propN)) {
    propN = '' + propN;
  }
  const lis = vm[VM_LISTENERS];
  let node = lis.get(propN);
  if (!node) {
    // node can't have any prototype function.
    node = createEmptyObject();
    Object.assign(node, {
      [VM_LISTENERS_PARENT]: vm,
      [VM_LISTENERS_ID]: propN,
      [VM_LISTENERS_TM]: null,
      [VM_LISTENERS_HANDLERS]: [],
      [VM_LISTENERS]: new Map()
    });
    lis.set(propN, node);
  }
  if (props.length - 1 === level) {
    return node;
  } else {
    return loopCreateNode(node, props, level + 1);
  }
}

export function vmAddListener(vm, prop, handler) {
  const props = isArray(prop) ? prop : prop.split('.');
  if (props.length === 0) return null;
  const node = loopCreateNode(vm, props);
  arrayPushIfNotExist(node[VM_LISTENERS_HANDLERS], handler);
}


function loopGetNode(vm, props, level = 0) {
  const propN = '' + props[level]; // force to string
  const lis = vm[VM_LISTENERS];
  const node = lis.get(propN);
  if (!node) {
    return null;
  }
  if (props.length - 1 === level) {
    return node;
  } else {
    return loopGetNode(node, props, level + 1);
  }
}

function loopDelNode(node) {
  if (!(VM_LISTENERS in node) || !(VM_LISTENERS_HANDLERS in node)) return;
  if (node[VM_LISTENERS_HANDLERS].length > 0) return;
  if (node[VM_LISTENERS].size > 0) return;
  /**
   * if one node don't have any listener or child, delete it.
   */
  const parent = node[VM_LISTENERS_PARENT];
  const id = node[VM_LISTENERS_ID];
  node[VM_LISTENERS_PARENT] = null; // unlink parent.
  parent[VM_LISTENERS].delete(id);
  loopDelNode(parent);
}
export function vmRemoveListener(vm, prop, handler) {
  const props = isArray(prop) ? prop : prop.split('.');
  if (props.length === 0) return null;
  const node = loopGetNode(vm, props);
  if (!node) return;
  const hs = node[VM_LISTENERS_HANDLERS];
  if (!handler) hs.length = 0; // remove all
  else arrayRemove(hs, handler);
  
  loopDelNode(node);
}

function loopClearNode(node) {
  node[VM_LISTENERS].forEach(sn => loopClearNode(sn));
  node[VM_LISTENERS].clear();

  if (node[VM_LISTENERS_TM]) {
    clearImm(node[VM_LISTENERS_TM]);
  }
  node[VM_LISTENERS_HANDLERS].length = 0;

  node[VM_LISTENERS_ID] = 
    node[VM_LISTENERS_PARENT] =
    node[VM_LISTENERS_TM] =
    node[VM_LISTENERS_HANDLERS] = null;
}
export function vmClearListener(vm) {
  vm[VM_LISTENERS].forEach(node => loopClearNode(node));
  vm[VM_LISTENERS].clear();
}

export function vmAddMessengerInterface(vm) {
  if (VM_LISTENERS in vm) return;
  vm[VM_LISTENERS] = new Map();
  vm[VM_ON] = (prop, handler) => vmAddListener(vm, prop, handler);
  vm[VM_OFF] = (prop, handler) => vmRemoveListener(vm, prop, handler);
  vm[VM_NOTIFY] = prop => vmNotifyChanged(vm, prop);
  vm[VM_CLEAR] = () => vmClearListener(vm);
}

const setImm = window.setImmediate || window.setTimeout;
const clearImm = window.clearImmediate || window.clearTimeout;

function loopHandle(node) {
  if (node[VM_LISTENERS_TM]) {
    clearImm(node[VM_LISTENERS_TM]);
    node[VM_LISTENERS_TM] = null;
  }
  if (node[VM_LISTENERS_HANDLERS].length > 0) {
    if (config.vmSyncNotify) {
      node[VM_LISTENERS_HANDLERS].forEach(handler => handler());
    } else {
      node[VM_LISTENERS_TM] = setImm(() => {
        node[VM_LISTENERS_TM] = null;
        node[VM_LISTENERS_HANDLERS].forEach(handler => handler());
      });
    }
  }
  const children = node[VM_LISTENERS];
  children.size > 0 && children.forEach(c => loopHandle(c));
}

function loopNotify(vm, props, level = 0) {
  const propN = '' + props[level]; // force to string
  const lis = vm[VM_LISTENERS];
  let node = lis.get(propN);
  if (node) {
    if (props.length - 1 === level) {
      loopHandle(node);
    } else {
      loopNotify(node, props, level + 1);
    }
  }
  node = lis.get(VM_LISTENERS_STAR);
  if (node) {
    if (props.length - 1 === level) {
      loopHandle(node);
    } else {
      loopNotify(node, props, level + 1);
    }
  }
  node = lis.get(VM_LISTENERS_DBSTAR);
  if (node) {
    loopHandle(node);
  }
}

export function vmNotifyChanged(vm, prop) {
  const props = isArray(prop) ? prop : prop.split('.');
  if (props.length === 0) return;
  loopNotify(vm, props);
}

export function vmWatch(vm, prop, handler) {
  vmAddMessengerInterface(vm);
  let dbStarIdx = -1;
  const props = (Array.isArray(prop) ? prop : prop.split('.')).map((p, i) => {
    if (startsWith(p, '_')) {
      console.error('Warning: watch property which name starts with char "_".');
    }
    if (p === '**') {
      dbStarIdx = i;
      return VM_LISTENERS_DBSTAR;
    }
    return p === '*' ? VM_LISTENERS_STAR : p;
  });
  if (dbStarIdx >= 0 && dbStarIdx !== props.length - 1) {
    /**
     * 'a.b.**' is good.
     * 'a.b.**.c' is bad.
     */
    throw new Error('wizard "**" must be last element in path.');
  }
  vmAddListener(vm, props, handler);
}

export function vmUnwatch(vm, prop, handler) {
  if (!(VM_LISTENERS in vm)) {
    return;
  }
  if (!prop) {
    vmClearListener(vm);
  } else {
    vmRemoveListener(vm, prop, handler);
  }
}