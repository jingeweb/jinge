import {
  vmAddListener,
  vmRemoveListener,
  vmNotifyChanged,
  VM_ON,
  VM_OFF,
  VM_CLEAR,
  VM_LISTENERS,
  VM_NOTIFY,
  vmClearListener,
  VM_LISTENERS_IMMS
} from '../viewmodel/notify';
import {
  VM_PARENTS,
  VM_DESTROIED
} from '../viewmodel/common';
import {
  Messenger,
  LISTENERS,
  CLEAR,
  NOTIFY
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
  assignObject,
  BEFORE_DESTROY_EVENT_NAME,
  AFTER_RENDER_EVENT_NAME,
  getOwnPropertyNames,
  getOwnPropertySymbols,
  arrayRemove
} from '../util';
import {
  getParent,
  removeChild,
  replaceChild,
  createComment,
  createElement,
  createTextNode,
  appendChild,
  registerEvent
} from '../dom';
import {
  wrapComponent,
  destroyViewModel,
  VM_SETTER_FN_MAP,
  VM_WRAPPER_PROXY
} from '../viewmodel/proxy';

export const NOTIFY_TRANSITION = Symbol('notify_transition');
export const TEMPLATE_RENDER = Symbol('template_render');
export const RENDER = Symbol('render');
export const RENDER_TO_DOM = Symbol('render_to_dom');
export const ARG_COMPONENTS = Symbol('arg_components');
export const PASSED_ATTRS = Symbol('passed_attrs');
export const CLONE = Symbol('clone');
export const DESTROY = Symbol('destroy');
export const CONTEXT = Symbol('context');
export const CONTEXT_STATE = Symbol('context_state');
export const ROOT_NODES = Symbol('root_nodes');
export const NON_ROOT_COMPONENT_NODES = Symbol('non_root_components');
export const REF_NODES = Symbol('ref_nodes');
export const SET_REF_NODE = Symbol('setChild');
export const REF_BELONGS = Symbol('ref_belongs');
export const RELATED_DOM_REFS = Symbol('related_dom_refs');
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

export const DOM_ON = Symbol('add_dom_listener');
export const DOM_PASS_LISTENERS = Symbol('pass_all_listeners_to_dom');
const DOM_LISTENER_DEREGISTERS = Symbol('dom_listener_deregisters');

function copyContext(context) {
  if (!context) return null;
  return assignObject(createEmptyObject(), context);
}

function _getOrCreate(comp, prop, fn) {
  let pv = comp[prop];
  if (!pv) {
    pv = comp[prop] = fn();
  }
  return pv;
}

function getOrCreateMap(comp, prop) {
  return _getOrCreate(comp, prop, () => new Map());
}

function getOrCreateArr(comp, prop) {
  return _getOrCreate(comp, prop, () => []);
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

    this[PASSED_ATTRS] = attrs;

    this[VM_PARENTS] = [];
    this[VM_DESTROIED] = false;
    this[VM_LISTENERS] = new Map();
    this[VM_LISTENERS_IMMS] = [];
    this[VM_SETTER_FN_MAP] = new Map();
    this[VM_WRAPPER_PROXY] = null;

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
     * REF_BELONGS contains all parent components which has this component as ref.
     *
     * 使用 ref: 标记的元素（Component 或 html node），会保存在 REF_NODES 中，
     *   之后通过 GET_REF 函数可以获取到元素实例。
     * 当标记的元素属于 <if> 或 <for> 等组件的 slot 时，这些元素可能被动态产生或销毁。
     *   需要在元素产生或销毁时，相应地把它从它所属于的 REF_NODES 中添加或删除。
     * 为了实现这个目的，对于 Component 元素，在将它添加到目标父组件的 REF_NODES 中的同时，
     *   会将目标父组件反向记录到该元素的 REF_BELONGS 中，从而实现当该元素被销毁时，
     *   可以将自己从它所属于的 REF_NODES 中删除；
     * 对于 html node 元素，我们会将其目标父组件记录到该元素的渲染关联组件的 RELATED_DOM_REFS。
     *   比如说，如果该 html 元素是 <if> 组件的 slot ，那它的渲染关联组件就是 <if> 内部的 Slot 组件，
     *   当 <if> 的条件发生变化时，实际上会销毁这个 Slot 组件。由于前面提到的 html 元素
     *   的 ref: 信息记录到了该 Slot 组件的 RELATED_DOM_REFS 里，因此就能反向地将
     *   这个 html 元素从它所属于的 REF_NODES 中删除。
     */
    this[REF_NODES] = null;
    this[REF_BELONGS] = null;
    this[RELATED_DOM_REFS] = null;

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
     * Store all dom listener deregisters.
     */
    this[DOM_LISTENER_DEREGISTERS] = null;
    return wrapComponent(this);
  }

  /**
   * Helper function to add dom event listener.
   * Return deregister function which will remove event listener.
   * If you do dot call deregister function, it will be auto called when component is destroied.
   * @param {HtmlElement} $el
   * @param {String} eventName
   * @param {Function} listener
   * @param {Boolean|Object} capture
   * @returns {Function} deregister function to remove listener
   */
  [DOM_ON]($el, eventName, listener, capture) {
    const lisDeregister = registerEvent($el, eventName, $event => {
      listener.call(this, $event);
    }, capture);

    const deregs = getOrCreateArr(this, DOM_LISTENER_DEREGISTERS);
    const deregister = () => {
      lisDeregister();
      arrayRemove(deregs, deregister);
    };
    deregs.push(deregister);
    return deregister;
  }

  /**
   * Helper function to pass all listener to first dom element.
   * @param {Array} ignoredEventNames event names not passed
   */
  [DOM_PASS_LISTENERS](ignoredEventNames) {
    if (this[STATE] !== STATE_RENDERED) {
      throw new Error('bindDOMListeners must be applied to component which is rendered.');
    }
    const lis = this[LISTENERS];
    if (!lis || lis.length === 0) {
      return;
    }
    const $el = this[GET_FIRST_DOM]();
    if ($el.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    lis.forEach((handlers, eventName) => {
      if (ignoredEventNames && ignoredEventNames.indexOf(eventName) >= 0) {
        return;
      }
      handlers.forEach(fn => {
        this[DOM_ON]($el, eventName, fn.tag ? $evt => {
          fn.tag.stop && $evt.stopPropagation();
          fn.tag.prevent && $evt.preventDefault();
          fn($evt);
        } : fn);
      });
    });
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

    this[HANDLE_BEFORE_DESTROY](); // destroy children first
    this[NOTIFY](BEFORE_DESTROY_EVENT_NAME, this);
    this[BEFORE_DESTROY]();

    // clear messenger listeners.
    super[CLEAR]();
    // remove component style
    StyleManager[CSTYLE_DEL](this.constructor.style);

    // destroy attrs passed to constructor
    const attrs = this[PASSED_ATTRS];
    destroyViewModel(attrs);
    (ARG_COMPONENTS in attrs) && (attrs[ARG_COMPONENTS] = null);
    (LISTENERS in attrs) && (attrs[LISTENERS] = null);
    attrs[CONTEXT] = null;
    this[PASSED_ATTRS] = null;

    // destroy view model
    destroyViewModel(this, false);
    this[VM_SETTER_FN_MAP].clear();
    this[VM_SETTER_FN_MAP] = null;

    // clear next tick update setImmediate
    if (this[UPDATE_NEXT_MAP]) {
      this[UPDATE_NEXT_MAP].forEach(imm => {
        clearImmediate(imm);
      });
      this[UPDATE_NEXT_MAP].clear();
    }

    // destroy related listener and ref:
    destroyRelatedVM(this);
    // clear context.
    destroyContext(this);
    // clear all dom event listener
    destroyDOMListeners(this);

    // clear properties
    this[STATE] = STATE_DESTROIED;
    this[RELATED_VM_LISTENERS] =
      this[NON_ROOT_COMPONENT_NODES] =
      this[REF_NODES] =
      this[REF_BELONGS] =
      this[ARG_COMPONENTS] = null;

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
    this[CONTEXT_STATE] = this[CONTEXT_STATE] > 0 ? -2 : -1; // has been rendered, can't modify context
    this[AFTER_RENDER]();
    this[NOTIFY](AFTER_RENDER_EVENT_NAME, this);
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
    if (isComponent(el)) {
      getOrCreateArr(el, REF_BELONGS).push([
        this, ref
      ]);
      return;
    }
    if (this === relatedComponent) {
      return;
    }
    getOrCreateArr(
      relatedComponent, RELATED_DOM_REFS
    ).push([this, ref, el]);
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

function destroyContext(comp) {
  const ctx = comp[CONTEXT];
  if (!ctx) return;
  if (comp[CONTEXT_STATE] === -2) {
    // maybe unnecessary to reset properties
    getOwnPropertyNames(ctx, propN => {
      ctx[propN] = null;
    });
    getOwnPropertySymbols(ctx, propN => {
      ctx[propN] = null;
    });
  }
  comp[CONTEXT] = null;
}

function destroyDOMListeners(component) {
  const deregisters = component[DOM_LISTENER_DEREGISTERS];
  if (!deregisters) return;
  deregisters.forEach(deregister => deregister());
  component[DOM_LISTENER_DEREGISTERS] = null;
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
  function _unref(refBelongs, el) {
    if (!refBelongs) return;
    refBelongs.forEach(info => {
      const map = info[0][REF_NODES];
      if (!map) return;
      const rns = map.get(info[1]);
      if (isArray(rns)) {
        arrayRemove(rns, el || info[2]);
      } else {
        map.delete(info[1]);
      }
    });
  }
  _destroy(RELATED_VM_LISTENERS, (ctx, hook) => {
    ctx[VM_OFF](hook[0], hook[1]);
  });

  _unref(comp[REF_BELONGS], comp);
  _unref(comp[RELATED_DOM_REFS]);
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
