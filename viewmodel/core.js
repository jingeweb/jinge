import {
  isObject,
  isString,
  isUndefined,
  Symbol,
  getOrCreateMapProperty,
  arrayRemove,
  getOwnPropertyNames,
  arrayPushIfNotExist,
  getOrCreateArrayProperty,
  isArray,
  arrayEqual
} from '../util';
import {
  config,
  CFG_VM_DEBUG
} from '../config';

export const VM_ATTRS = Symbol('vm_injected_attrs');
export const VM_DEBUG_NAME = Symbol('name');
export const VM_PROXY = Symbol('wrapper_proxy_of_host');
export const VM_ON = Symbol('fn_add_listener');
export const VM_OFF = Symbol('fn_remove_listener');
export const VM_NOTIFY = Symbol('fn_notify_listener');
export const VM_NOTIFIABLE = Symbol('notifiable');
export const VM_HOST = Symbol('host');
export const VM_RELATED_LISTENERS = Symbol('vm_related_listeners');

const PARENTS = Symbol('parents');
const LISTENERS_STAR = Symbol('*');
const LISTENERS_DBSTAR = Symbol('**');
const LISTENERS = Symbol('listeners');
const LISTENERS_ID = Symbol('listenrs_id');
const LISTENERS_PARENT = Symbol('vm_listeners_parent');
const LISTENERS_HANDLERS = Symbol('vm_listeners_handlers');
const LISTENERS_IMMS = Symbol('vm_listeners_imms');

export const ADD_PARENT = Symbol('fn_add_parent');
export const REMOVE_PARENT = Symbol('fn_remove_parent');
export const SHIFT_PARENT = Symbol('fn_shift_parent');
export const DESTROY = Symbol('fn_destroy');

export function isInnerObj(v) {
  const clazz = v.constructor;
  return clazz === RegExp || clazz === Date || clazz === Boolean;
}
export function isViewModel(obj) {
  return isObject(obj) && !isInnerObj(obj) && (VM_ATTRS in obj);
}

export function isPublicProp(v) {
  return isString(v) && v.charCodeAt(0) !== 95;
}

class Node {
  constructor(parentNode, propertyName) {
    this[LISTENERS_PARENT] = parentNode;
    this[LISTENERS_ID] = propertyName;
    this[LISTENERS] = null;
    this[LISTENERS_HANDLERS] = null;
  }
}

function getPropN(v) {
  if (v === LISTENERS_DBSTAR || v === LISTENERS_STAR || isString(v)) {
    return v;
  }
  if (v === null) {
    return 'null';
  }
  if (isUndefined(v)) {
    return 'undefined';
  }
  return v.toString();
}

function loopCreateNode(vm, props, level = 0) {
  const propertyName = getPropN(props[level]);
  if (!propertyName) {
    return null;
  }
  const listeners = getOrCreateMapProperty(vm, LISTENERS);
  let node = listeners.get(propertyName);
  if (!node) {
    node = new Node(vm, propertyName);
    listeners.set(propertyName, node);
  }
  if (props.length - 1 === level) {
    return node;
  } else {
    return loopCreateNode(node, props, level + 1);
  }
}

function loopGetNode(vm, props, level = 0) {
  const propertyName = getPropN(props[level]);
  if (!propertyName) {
    return null;
  }
  const listeners = vm[LISTENERS];
  const node = listeners.get(propertyName);
  if (!node) {
    return null;
  }
  if (props.length - 1 === level) {
    return node;
  } else {
    return loopGetNode(node, props, level + 1);
  }
}

function delNode(node) {
  if ((node[LISTENERS_HANDLERS] && node[LISTENERS_HANDLERS].length > 0) ||
    (node[LISTENERS] && node[LISTENERS].size > 0)
  ) {
    return;
  }
  /**
   * if one node don't have any listener or child, delete it.
   */
  const parent = node[LISTENERS_PARENT];
  const id = node[LISTENERS_ID];
  node[LISTENERS_PARENT] = null; // unlink parent.
  parent[LISTENERS].delete(id);
  return parent;
}

function loopClearNode(node, isRoot = true) {
  const listeners = node[LISTENERS];
  if (listeners) {
    // loop clear all child nodes
    listeners.forEach(sn => loopClearNode(sn, false));
    listeners.clear();
    node[LISTENERS] = null;
  }
  if (isRoot) {
    return;
  }
  // destroy all handlers
  const handlers = node[LISTENERS_HANDLERS];
  if (handlers) {
    handlers.length = 0;
    node[LISTENERS_HANDLERS] = null;
  }
  // unlink parent
  node[LISTENERS_PARENT] = null;
}

const _handleTasks = new Map();
function _handleOnce(node, handler, propPath, imms) {
  const _has = _handleTasks.has(handler);
  _handleTasks.set(handler, propPath);
  if (_has) {
    return;
  }
  const imm = setImmediate(() => {
    arrayRemove(imms, imm);
    try {
      handler(_handleTasks.get(handler));
    } finally {
      _handleTasks.delete(handler);
    }
  });
  imms.push(imm);
}

function loopHandle(propPath, node, imms) {
  const handlers = node[LISTENERS_HANDLERS];
  handlers && handlers.forEach(handler => {
    imms ? _handleOnce(node, handler, propPath, imms) : handler(propPath);
  });
  const listeners = node[LISTENERS];
  listeners && listeners.forEach(c => {
    loopHandle(propPath, c, imms);
  });
}

function loopNotify(vm, props, imms, level = 0) {
  const listeners = vm[LISTENERS];
  if (!listeners) {
    return;
  }
  const propertyName = getPropN(props[level]);
  if (!propertyName) {
    return;
  }
  let node = listeners.get(propertyName);
  if (node) {
    if (props.length - 1 === level) {
      loopHandle(props, node, config[CFG_VM_DEBUG] ? null : imms);
    } else {
      loopNotify(node, props, imms, level + 1);
    }
  }
  node = listeners.get(LISTENERS_STAR);
  if (node) {
    if (props.length - 1 === level) {
      loopHandle(props, node, null);
    } else {
      loopNotify(node, props, imms, level + 1);
    }
  }
  node = listeners.get(LISTENERS_DBSTAR);
  if (node) {
    loopHandle(props, node, null);
  }
}

function getProps(prop) {
  return isString(prop) ? (
    prop.indexOf('.') > 0 ? prop.split('.') : [prop]
  ) : prop;
}

export class ViewModelAttrs {
  constructor(host) {
    this[VM_HOST] = host;
    this[VM_NOTIFIABLE] = true;
    this[VM_PROXY] = null;
    this[PARENTS] = null;
    this[LISTENERS] = null;
    this[LISTENERS_IMMS] = null;
  }

  [ADD_PARENT](parent, prop) {
    const pArr = getOrCreateArrayProperty(this, PARENTS);
    pArr.push([parent, prop]);
  }

  [REMOVE_PARENT](parent, prop) {
    const pArr = this[PARENTS];
    if (!pArr) return;
    const idx = pArr.findIndex(ps => ps[0] === parent && ps[1] === prop);
    if (idx >= 0) pArr.splice(idx, 1);
  }

  [SHIFT_PARENT](parent, prop, delta) {
    const pArr = this[PARENTS];
    if (!pArr) return;
    const ps = pArr.find(ps => ps[0] === parent && ps[1] === prop);
    if (ps) {
      ps[1] += delta;
    }
  }

  [VM_ON](prop, handler, relatedComponent) {
    const node = loopCreateNode(this, getProps(prop));
    if (!node) {
      return;
    }
    arrayPushIfNotExist(
      getOrCreateArrayProperty(node, LISTENERS_HANDLERS),
      handler
    );
    const host = this[VM_HOST];
    if (!relatedComponent || !(VM_RELATED_LISTENERS in relatedComponent)) {
      return;
    }
    // unwrap component out of wrapper proxy
    relatedComponent = relatedComponent[VM_ATTRS][VM_HOST];
    if (host === relatedComponent) {
      return;
    }
    vmRelatedOn(relatedComponent, host, prop, handler);
  }

  [VM_OFF](prop, handler, relatedComponent) {
    const node = loopGetNode(this, getProps(prop));
    if (!node) {
      return;
    }
    const hs = node[LISTENERS_HANDLERS];
    if (!handler) hs.length = 0; // remove all
    else arrayRemove(hs, handler);

    delNode(node);

    const host = this[VM_HOST];
    if (!relatedComponent || !(VM_RELATED_LISTENERS in relatedComponent)) {
      return;
    }
    // unwrap component out of wrapper proxy
    relatedComponent = relatedComponent[VM_ATTRS][VM_HOST];
    if (host === relatedComponent) {
      return;
    }
    vmRelatedOff(relatedComponent, host, prop, handler);
  }

  [VM_NOTIFY](prop) {
    if (!this[VM_NOTIFIABLE]) {
      return;
    }
    const props = getProps(prop);
    if (this[LISTENERS]) {
      const imms = getOrCreateArrayProperty(this, LISTENERS_IMMS);
      loopNotify(this, props, imms);
    }
    const pArr = this[PARENTS];
    pArr && pArr.forEach(ps => {
      const vmAttrs = ps[0][VM_ATTRS];
      if (!vmAttrs) {
        console.error('dev-warn-unexpected: parent of ViewModelAttrs has been destroied but not unlink.');
        return;
      }
      vmAttrs[VM_NOTIFY](
        [ps[1]].concat(props)
      );
    });
  }

  [DESTROY](unlinkHostProperties = true) {
    // mark as non-notifiable
    this[VM_NOTIFIABLE] = false;
    // clear assignment parents
    const pArr = this[PARENTS];
    pArr && (pArr.length = 0);
    this[PARENTS] = null;
    // clear all listener handlers waiting to call.
    const imms = this[LISTENERS_IMMS];
    imms && imms.forEach(imm => {
      clearImmediate(imm);
    });
    this[LISTENERS_IMMS] = null;
    // clear listeners
    loopClearNode(this);
    // unlink host object wrapper proxy
    this[VM_PROXY] = null;

    const host = this[VM_HOST];

    // destroy related listeners
    if (VM_RELATED_LISTENERS in host) {
      const lmap = host[VM_RELATED_LISTENERS];
      if (lmap) {
        lmap.forEach((arr, component) => {
          arr.forEach(hook => {
            component[VM_ATTRS][VM_OFF](hook[0], hook[1]);
          });
          arr.length = 0;
        });
        lmap.clear();
        host[VM_RELATED_LISTENERS] = null;
      }
    }
    // unlink vm host
    this[VM_HOST] = null;
    /*
     * by default, we will reset VM_HOST object's all public properties to null
     *   to remove VM_HOST object from old property value's VM_PARENTS
     *
     * 默认情况下（即 === true），会将 VM_HOST 对象的所有（不以 '_' 打头的）公共属性重置为 null，这个赋值会触发 ./proxy.js 中的逻辑，
     *   将该对象从属性原来的值的 VM_PARENTS 中移除，从而达到解除 ViewModel 之间的关联，回收资源和防止潜在 bug 的目的。
     *
     * 当 VM 对象是某个类的实例时，由于类可以通过 setter 函数定义公共属性，而这一类的公共属性不能
     *   通过 getOwnPropertyNames 来遍历。因此这种情况，需要主动传递 unlinkHostProperties = false
     *   来禁用默认的重置属性逻辑，然后自己处理相关的重置逻辑。比如 Component 组件。
     */
    unlinkHostProperties && getOwnPropertyNames(host, prop => {
      if (prop.charCodeAt(0) === 95) {
        return;
      }
      const v = host[prop];
      if (!isObject(v)) {
        return;
      }
      const a = v[VM_ATTRS];
      a && a[REMOVE_PARENT](host, prop);
      host[prop] = null;
    });
  }
}

function vmRelatedOn(relatedComponent, hostViewModel, prop, handler) {
  const rvl = getOrCreateMapProperty(relatedComponent, VM_RELATED_LISTENERS);
  let hook = rvl.get(hostViewModel);
  if (!hook) {
    hook = [];
    rvl.set(hostViewModel, hook);
  }
  hook.push([prop, handler]);
}

function vmRelatedOff(relatedComponent, hostViewModel, prop, handler) {
  const rvl = relatedComponent[VM_RELATED_LISTENERS];
  if (!rvl) return;
  const hook = rvl.get(hostViewModel);
  if (!hook) return;
  const isPropArray = isArray(prop);
  const i = hook.findIndex(it => {
    return handler === it[1] &&
      (isPropArray
        ? arrayEqual(prop, it[0])
        : prop === it[0]
      );
  });
  if (i >= 0) {
    hook.splice(i, 1);
  }
}

export function vmWatch(vm, prop, handler) {
  const vmAttrs = vm[VM_ATTRS];
  if (!vmAttrs) {
    throw new Error('vmWatch require ViewModel object');
  }
  let dbStarIdx = -1;
  const props = getProps(prop).map((p, i) => {
    if (p === '**') {
      dbStarIdx = i;
      return LISTENERS_DBSTAR;
    }
    return p === '*' ? LISTENERS_STAR : p;
  });
  if (dbStarIdx >= 0 && dbStarIdx !== props.length - 1) {
    /**
     * 'a.b.**' is good.
     * 'a.b.**.c' is bad.
     */
    throw new Error('wizard "**" must be last element in path.');
  }
  vmAttrs[VM_ON](props, handler);
}

export function vmUnwatch(vm, prop, handler) {
  const vmAttrs = vm[VM_ATTRS];
  if (!vmAttrs[VM_NOTIFIABLE]) {
    return;
  }
  if (!prop) {
    loopClearNode(vmAttrs);
  } else {
    vmAttrs[VM_OFF](prop, handler);
  }
}
