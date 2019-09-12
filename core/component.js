import {
  vmAddListener,
  vmRemoveListener,
  vmNotifyChanged,
  VM_ON,
  VM_OFF,
  VM_CLEAR,
  VM_LISTENERS,
  VM_NOTIFY,
  vmClearListener
} from '../viewmodel/notify';
import {
  VM_PARENTS,
  VM_DESTROIED
} from '../viewmodel/common';
import {
  Messenger,
  LISTENERS,
  CLEAR
} from './messenger';
import {
  manager as StyleManager,
  CSTYLE_PID,
  CSTYLE_ADD,
  CSTYLE_DEL,
  CSTYLE_ATTACH
} from './style';
import {
  Symbol,
  isDOMNode,
  instanceOf,
  assertFail,
  isFunction,
  STR_DEFAULT,
  isObject,
  isArray,
  createEmptyObject,
  arrayFindIndex,
  arrayEqual,
  STR_EMPTY,
  setImmediate,
  clearImmediate,
  assignObject
} from '../util';
import {
  getParent,
  removeChild,
  replaceChild,
  createComment,
  createElement,
  createTextNode,
  appendChild,
  addEvent,
  removeEvent
} from '../dom';
import {
  wrapComponent
} from '../viewmodel/proxy';

export const BINDED_DOM_LISTENERS = Symbol('binded_dom_listeners');
export const NOTIFY_TRANSITION = Symbol('notify_transition');
export const TEMPLATE_RENDER = Symbol('template_render');
export const RENDER = Symbol('render');
export const RENDER_TO_DOM = Symbol('render_to_dom');
export const ARG_COMPONENTS = Symbol('arg_components');
export const CLONE = Symbol('clone');
export const DESTROY = Symbol('destroy');
export const CONTEXT = Symbol('context');
export const CONTEXT_STATE = Symbol('context_state');
export const ROOT_NODES = Symbol('root_nodes');
export const NON_ROOT_COMPONENT_NODES = Symbol('non_root_components');
export const REF_NODES = Symbol('ref_nodes');
export const SET_REF_NODE = Symbol('setChild');
export const RELATED_VM_REFS = Symbol('related_refs');
export const RELATED_VM_LISTENERS = Symbol('related_vm_listeners');
export const RELATED_VM_ON = Symbol('related_vm_on');
export const RELATED_VM_OFF = Symbol('related_vm_off');
export const GET_STATE_NAME = Symbol('get_state_name');
export const AFTER_RENDER = Symbol('afterRender');
export const HANDLE_AFTER_RENDER = Symbol('handleAfterRender');
export const HANDLE_REMOVE_ROOT_DOMS = Symbol('handle_remove_root_doms');
export const HANDLE_BEFORE_DESTROY = Symbol('handleBeforeDestroy');
export const GET_FIRST_DOM = Symbol('getFirstHtmlDOM');
export const GET_LAST_DOM = Symbol('getLastHtmlDOM');
export const GET_TRANSITION_DOM = Symbol('getTransitionDOM');
export const BEFORE_DESTROY = Symbol('beforeDestroy');
export const GET_CONTEXT = Symbol('getContext');
export const SET_CONTEXT = Symbol('setContext');
export const GET_REF = Symbol('getRef');
export const UPDATE = Symbol('update');
export const UPDATE_IF_NEED = Symbol('update_if_need');
export const UPDATE_NEXT_MAP = Symbol('update_next_tick_map');
export const STATE = Symbol('state');
export const STATE_INITIALIZE = 0;
export const STATE_RENDERED = 1;
export const STATE_WILLDESTROY = 2;
export const STATE_DESTROIED = 4;
export const STATE_NAMES = [
  'initialize', 'rendered', 'willdestroy', 'destroied'
];

function copyContext(context) {
  if (!context) return null;
  return assignObject(createEmptyObject(), context);
}

function getOrCreateMap(comp, prop) {
  let m = comp[prop];
  if (!m) m = comp[prop] = new Map();
  return m;
}

export class Component extends Messenger {
  /**
   * compiler will auto transform the `template` getter's return value from String to Render Function.
   */
  static get template() {
    return null;
  }

  static get style() {
    return null;
  }

  constructor(attrs) {
    if (attrs === null || !isObject(attrs) || !(VM_PARENTS in attrs)) {
      throw new Error('First argument passed to Component constructor must be ViewModel with Messenger interface. See https://[todo]');
    }
    super(attrs[LISTENERS]);
    this[VM_PARENTS] = null;
    this[VM_DESTROIED] = false;
    this[VM_LISTENERS] = null;
    this[UPDATE_NEXT_MAP] = null;
    this[CSTYLE_PID] = null;
    this[CONTEXT] = attrs[CONTEXT];
    this[CONTEXT_STATE] = 0;
    this[ARG_COMPONENTS] = attrs[ARG_COMPONENTS];
    this[STATE] = STATE_INITIALIZE;
    /**
     * ROOT_NODES means root children of this component,
     *   include html-nodes and component-nodes.
     * We use this infomation to remove DOM after this component is destroied.
     * We do not maintain the whole parent-child view-tree but only root children,
     * because when we remove the root children, whole view-tree will be
     * removed, so we do not need waste memory to maintain whole view-tree.
     */
    this[ROOT_NODES] = [];
    /**
     * NON_ROOT_COMPONENT_NODES means nearest non-root component-nodes in the view-tree.
     * Node in view-tree have two types, html-node and component-node.
     *   html-node include html dom node and html text node,
     *   component-node is an instance of a Component.
     * For example, we have rendered a view-tree:
     *             RootApp(Component)
     *             /     |          \
     *         h1(Html)  h2(Html)  A(Component)
     *            |                 |
     *        C(Component)     D(Component)
     *
     * The nearest non-root component-nodes of RootApp include C,
     *   but not include A(as it's root) or D(as it's not nearest).
     *
     * By the way, the ROOT_NODES of view-tree above is [h1, h2, A]
     */
    this[NON_ROOT_COMPONENT_NODES] = [];
    /**
     * REF_NODES contains all children with ref: attribute.
     */
    this[REF_NODES] = null;
    /**
     * If some child of this component is passed as argument(ie.
     * use arg:pass attribute) like ng-tranclude in angular 1.x,
     * the child may contain some messenger listeners not belong to
     * this component but belong to outer parent.
     *
     * When destroy this component, we should also remove messenger listeners
     *   belong to outer parent to prevent memory leak.
     * To implement this goal, we maitain RELATED_VM_LISTENERS.
     * When render view-tree, any messenger listeners belong to outer
     * parent, will be also linked under RELATED_VM_LISTENERS, then
     * when we destroy this component, the listeners can also be clear.
     *
     * For examle:
     *
     * <!-- outer parent: RootApp -->
     * <div>
     * <if expect="show">
     * <Tooltip>
     * <argument arg:pass="default">
     * <p>hello, world. my name is ${name}</p>
     * </argument>
     * </Tooltip>
     * </if>
     * </div>
     *
     * when the `show` variable changed from true to false, the
     * Tooltip component will be destroy. The messenger listener belong
     * to the outer parent RootApp which watch `name` variable should
     * also be removed.
     */
    this[RELATED_VM_LISTENERS] = null;
    /**
     * Simalary as RELATED_VM_LISTENERS, RELATED_VM_REFS stores
     *   ref elements of parent component.
     */
    this[RELATED_VM_REFS] = null;
    /**
     * Only be used by bindDOMListeners and unbindDOMListeners
     */
    this[BINDED_DOM_LISTENERS] = null;
    return wrapComponent(this);
  }

  [GET_TRANSITION_DOM]() {
    const rns = this[ROOT_NODES];
    if (rns.length === 0) assertFail();
    const el = rns[0];
    return isComponent(el) ? el[GET_TRANSITION_DOM]() : el;
  }

  [GET_FIRST_DOM]() {
    const rns = this[ROOT_NODES];
    if (rns.length === 0) assertFail();
    const el = rns[0];
    return isComponent(el) ? el[GET_FIRST_DOM]() : el;
  }

  [GET_LAST_DOM]() {
    const rns = this[ROOT_NODES];
    if (rns.length === 0) assertFail();
    const el = rns[rns.length - 1];
    return isComponent(el) ? el[GET_LAST_DOM]() : el;
  }

  [VM_ON](prop, handler, componentCtx) {
    vmAddListener(this, prop, handler);
    if (!componentCtx || !isComponent(componentCtx) || componentCtx === this) return;
    componentCtx[RELATED_VM_ON](this, prop, handler);
  }

  [RELATED_VM_ON](vm, prop, handler) {
    const rvl = getOrCreateMap(this, RELATED_VM_LISTENERS);
    let hook = rvl.get(vm);
    if (!hook) {
      hook = [];
      rvl.set(vm, hook);
    }
    hook.push([prop, handler]);
  }

  [RELATED_VM_OFF](vm, prop, handler) {
    const rvl = this[RELATED_VM_LISTENERS];
    if (!rvl) return;
    const hook = rvl.get(vm);
    if (!hook) return;
    const isPropArray = isArray(prop);
    const i = arrayFindIndex(hook, it => {
      if (handler === it[1] && (isPropArray ? arrayEqual(prop, it[0]) : prop === it[0])) {
        return true;
      } else {
        return false;
      }
    });
    if (i >= 0) hook.splice(i, 1);
  }

  [VM_OFF](prop, handler, componentCtx) {
    vmRemoveListener(this, prop, handler);
    if (!componentCtx || !isComponent(componentCtx) || componentCtx === this) return;
    componentCtx[RELATED_VM_OFF](this, prop, handler);
  }

  [VM_CLEAR]() {
    vmClearListener(this);
  }

  [VM_NOTIFY](prop) {
    return vmNotifyChanged(this, prop);
  }

  [CLONE]() {
    throw new Error('abstract method');
  }

  [RENDER]() {
    const Clazz = this.constructor;
    let renderFn = Clazz.template;
    if (!renderFn && this[ARG_COMPONENTS]) {
      renderFn = this[ARG_COMPONENTS][STR_DEFAULT];
    }
    if (!isFunction(renderFn)) {
      assertFail(`render function of ${Clazz.name} not found. Forget static getter "template"?`);
    }
    StyleManager[CSTYLE_ADD](Clazz.style);
    return renderFn(this);
  }

  /**
   *
   * @param {HTMLElement} $targetDOM
   * @param {Boolean} replaceMode if false, use append mode
   */
  [RENDER_TO_DOM]($targetDOM, replaceMode = true) {
    if (!isDOMNode($targetDOM)) assertFail();
    if (this[STATE] !== STATE_INITIALIZE) {
      assertFail();
    }
    const rr = assertRenderResults(this[RENDER]());
    StyleManager[CSTYLE_ATTACH]();
    if (replaceMode) {
      replaceChild(getParent($targetDOM), rr, $targetDOM);
    } else {
      appendChild($targetDOM, rr);
    }
    this[HANDLE_AFTER_RENDER]();
  }

  [DESTROY](removeDOM = true) {
    if (this[STATE] > STATE_WILLDESTROY) return;
    this[STATE] = STATE_WILLDESTROY;
    this[VM_DESTROIED] = true;
    this[BEFORE_DESTROY]();
    super[CLEAR](); // dont forgot call super clear.
    // clear next tick update setImmediate
    if (this[UPDATE_NEXT_MAP]) {
      this[UPDATE_NEXT_MAP].forEach(imm => {
        clearImmediate(imm);
      });
      this[UPDATE_NEXT_MAP].clear();
    }
    this[VM_CLEAR](); // dont forgot clear vm listeners
    destroyRelatedVM(this);
    this[HANDLE_BEFORE_DESTROY]();

    // remove component style
    StyleManager[CSTYLE_DEL](this.constructor.style);

    // clear properties
    this[STATE] = STATE_DESTROIED;
    this[RELATED_VM_LISTENERS] =
      this[NON_ROOT_COMPONENT_NODES] =
      this[REF_NODES] =
      this[ARG_COMPONENTS] =
      this[CONTEXT] = null;

    if (this[BINDED_DOM_LISTENERS]) {
      unbindDOMListeners(this);
    }
    // remove dom
    if (removeDOM) {
      this[HANDLE_REMOVE_ROOT_DOMS]();
    }
  }

  [HANDLE_BEFORE_DESTROY]() {
    this[NON_ROOT_COMPONENT_NODES].forEach(component => {
      component[DESTROY](false);
    });
    this[ROOT_NODES].forEach(node => {
      if (isComponent(node)) {
        node[DESTROY](false);
      }
    });
  }

  [HANDLE_REMOVE_ROOT_DOMS]($parent) {
    this[ROOT_NODES].forEach(node => {
      if (isComponent(node)) {
        node[HANDLE_REMOVE_ROOT_DOMS]($parent);
      } else {
        if (!$parent) $parent = getParent(node);
        removeChild($parent, node);
      }
    });
    this[ROOT_NODES] = null;
  }

  [HANDLE_AFTER_RENDER]() {
    this[ROOT_NODES].forEach(n => {
      if (isComponent(n)) n[HANDLE_AFTER_RENDER]();
    });
    this[NON_ROOT_COMPONENT_NODES].forEach(n => {
      if (isComponent(n)) n[HANDLE_AFTER_RENDER]();
    });
    this[STATE] = STATE_RENDERED;
    this[CONTEXT_STATE] = -1; // has been rendered, can't modify context
    this[AFTER_RENDER]();
  }

  /**
   *
   * @param {Function|boolean} handler
   * @param {boolean} nextTick
   */
  [UPDATE_IF_NEED](handler = null, nextTick = true) {
    if (this[STATE] !== STATE_RENDERED) {
      return;
    }
    if (handler === false) {
      return this[UPDATE]();
    }

    if (!isFunction(handler)) {
      handler = this[UPDATE];
    }

    if (!nextTick) {
      handler.call(this);
      return;
    }

    let ntMap = this[UPDATE_NEXT_MAP];
    if (!ntMap) {
      ntMap = this[UPDATE_NEXT_MAP] = new Map();
    }
    if (ntMap.has(handler)) {
      // already in queue.
      return;
    }
    ntMap.set(handler, setImmediate(() => {
      ntMap.delete(handler);
      handler.call(this);
    }));
  }

  [UPDATE]() {
    throw new Error('abstract method');
  }

  [GET_STATE_NAME]() {
    return STATE_NAMES[this[STATE]];
  }

  [SET_CONTEXT](id, ctx, forceOverride = false) {
    if (this[CONTEXT_STATE] < 0) {
      throw new Error('Can\'t setContext after component has been rendered. Try put setContext code into constructor.');
    }
    if (this[CONTEXT_STATE] === 0) {
      // we copy context to make sure child component do not modify context passed from parent.
      // we do not copy it by default until setContext function is called, because it unnecessary to waste memory if
      // child component do not modify the context.
      if (!this[CONTEXT]) {
        this[CONTEXT] = createEmptyObject();
      } else {
        this[CONTEXT] = copyContext(this[CONTEXT]);
      }
      this[CONTEXT_STATE] = 1; // has been copied.
    }
    if (id in this[CONTEXT]) {
      // override exist may case hidden bug hard to debug.
      // so we force programmer to pass third argument to
      //   tell us he/she know what he/she is doing.
      if (!forceOverride) {
        throw new Error(`Contenxt with id: ${id.toString()} is exist. Pass third argument forceOverride=true to override it.`);
      }
    }
    this[CONTEXT][id] = ctx;
  }

  [GET_CONTEXT](id) {
    return this[CONTEXT] ? this[CONTEXT][id] : null;
  }

  [SET_REF_NODE](ref, el, relatedComponent) {
    const rns = getOrCreateMap(this, REF_NODES);
    let elOrArr = rns.get(ref);
    if (!elOrArr) {
      rns.set(ref, el);
    } else if (isArray(elOrArr)) {
      elOrArr.push(el);
    } else {
      elOrArr = [elOrArr, el];
      rns.set(ref, elOrArr);
    }
    if (relatedComponent === this) return;
    const rvrs = getOrCreateMap(relatedComponent, RELATED_VM_REFS);
    let rs = rvrs.get(this);
    if (!rs) {
      rs = [];
      rvrs.set(this, rs);
    }
    rs.push(ref);
  }

  /**
   * Get child node(or nodes) marked by 'ref:' attribute in template
   * @param {String} ref
   * @returns {Node|Array<Node>}
   */
  [GET_REF](ref) {
    if (this[STATE] !== STATE_RENDERED) {
      console.error(`Warning: call getChild before component '${this.constructor.name}' is rendered will get nothing, try put getChild into afterRender lifecycle hook.`);
    }
    return this[REF_NODES] ? this[REF_NODES].get(ref) : null;
  }

  /**
   * lifecycle hook, called after rendered.
   */
  [AFTER_RENDER]() {
    // lifecycle hook, default do nothing.
  }

  /**
   * lifecycle hook, called before destroy.
   */
  [BEFORE_DESTROY]() {
    // lifecycle hook, default do nothing.
  }
}

export function destroyRelatedVM(comp) {
  function _destroy(prop, cb) {
    const m = comp[prop];
    if (!m) return;
    m.forEach((arr, ctx) => {
      arr.forEach(k => cb(ctx, k));
      arr.length = 0;
    });
    m.clear();
  }
  _destroy(RELATED_VM_LISTENERS, (ctx, hook) => {
    ctx[VM_OFF](hook[0], hook[1]);
  });
  _destroy(RELATED_VM_REFS, (ctx, ref) => {
    // const rn = ctx[REF_NODES];
    // if (rn) debugger;
    // rn.delete(ref);
    // debugger;
    ctx[REF_NODES].delete(ref);
  });
}

export function isComponent(c) {
  return instanceOf(c, Component);
}

export function assertRenderResults(renderResults) {
  if (!isArray(renderResults) || renderResults.length === 0) {
    throw new Error('Render results of component is empty');
  }
  return renderResults;
}

export function operateRootHtmlDOM(fn, el, ...args) {
  if (!isComponent(el)) return fn(el, ...args);
  el[ROOT_NODES].forEach(ce => {
    operateRootHtmlDOM(fn, ce, ...args);
  });
}

export function emptyRenderFn(component) {
  const el = createComment(STR_EMPTY);
  component[ROOT_NODES].push(el);
  return [el];
}

export function errorRenderFn(component) {
  const el = createElement('span', {
    style: 'color: red !important;'
  });
  el.textContent = 'template parsing failed! please check webpack log.';
  component[ROOT_NODES].push(el);
  return [el];
}

export function textRenderFn(component, txtContent) {
  const el = createTextNode(txtContent);
  component[ROOT_NODES].push(el);
  return el;
}

/**
 * bind(attach) listeners to rendered DOM element.
 * @param {Component} component
 * @param {Array<String>} ignoredEventNames
 */
export function bindDOMListeners(component, ignoredEventNames) {
  if (component[STATE] !== STATE_RENDERED) {
    throw new Error('bindDOMListeners must be applied to component which is rendered.');
  }
  const lis = component[LISTENERS];
  if (!lis || lis.length === 0) {
    return;
  }
  const $el = component[GET_FIRST_DOM]();
  if ($el.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  let bindedListeners = component[BINDED_DOM_LISTENERS];
  if (bindedListeners) {
    throw new Error('bindedDOMListeners can only be applied once.');
  } else {
    bindedListeners = component[BINDED_DOM_LISTENERS] = {
      el: $el,
      ar: []
    };
  }
  lis.forEach((handlers, eventName) => {
    if (ignoredEventNames && ignoredEventNames.indexOf(eventName) >= 0) return;
    handlers.forEach(fn => {
      const tag = fn.tag || false;
      let handler = fn;
      if (tag && (tag.stop || tag.prevent)) {
        handler = function($evt) {
          fn($evt);
          tag.stop && $evt.stopPropagation();
          tag.prevent && $evt.preventDefault();
        };
      }
      addEvent($el, eventName, handler, tag);
      bindedListeners.ar.push([eventName, handler]);
    });
  });
}

/**
 * unbind(detach) listeners from rendered DOM element.
 * @param {Component} component
 */
export function unbindDOMListeners(component) {
  const bindedListeners = component[BINDED_DOM_LISTENERS];
  if (!bindedListeners) {
    return;
  }
  bindedListeners.ar.forEach(saved => {
    removeEvent(bindedListeners.el, saved[0], saved[1]);
  });
  component[BINDED_DOM_LISTENERS] = null;
}
