import {
  Symbol,
  isDOMNode,
  assertFail,
  isFunction,
  STR_DEFAULT,
  isObject,
  isArray,
  createEmptyObject,
  setImmediate,
  clearImmediate,
  assignObject,
  BEFORE_DESTROY_EVENT_NAME,
  AFTER_RENDER_EVENT_NAME,
  getOwnPropertyNames,
  getOwnPropertySymbols,
  arrayRemove,
  getOrCreateMapProperty,
  getOrCreateArrayProperty,
  getParent,
  removeChild,
  replaceChild,
  appendChild,
  registerEvent
} from '../util';
import {
  VM_ATTRS,
  VM_DESTROY,
  VM_NOTIFIABLE,
  VM_REMOVE_PARENT,
  VM_HOST,
  VM_RELATED_LISTENERS,
  wrapComponent,
  VM_SETTER_FN_MAP
} from '../vm';
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
  i18n as i18nService
} from './i18n';

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
export const GET_STATE_NAME = Symbol('get_state_name');
export const AFTER_RENDER = Symbol('afterRender');
export const HANDLE_AFTER_RENDER = Symbol('handleAfterRender');
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

export const I18N_WATCH = Symbol('i18n_watch');
const DOM_LISTENER_DEREGISTERS = Symbol('dom_listener_deregisters');
const I18N_LISTENER_DEREGISTERS = Symbol('i18n_listener_deregisters');

function copyContext(context) {
  if (!context) return null;
  return assignObject(createEmptyObject(), context);
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

  /**
   * @param {Attributes} attrs Attributes passed from parent Component
   */
  constructor(attrs) {
    if (!isObject(attrs) || !(VM_ATTRS in attrs)) {
      throw new Error('First argument passed to Component constructor must be ViewModel with Messenger interface. See https://[todo]');
    }
    super(attrs[LISTENERS]);

    this[PASSED_ATTRS] = attrs;

    this[VM_ATTRS] = null;
    this[VM_SETTER_FN_MAP] = null;

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
     * To implement this goal, we maitain VM_RELATED_LISTENERS.
     * When render view-tree, any messenger listeners belong to outer
     * parent, will be also linked under VM_RELATED_LISTENERS, then
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
    this[VM_RELATED_LISTENERS] = null;

    // saved listener deregisters, will be auto called when component is destroied
    this[DOM_LISTENER_DEREGISTERS] = null;
    this[I18N_LISTENER_DEREGISTERS] = null;

    return wrapComponent(this);
  }

  /**
   * Helper function to add i18n LOCALE_CHANGE listener.
   * Return deregister function which will remove event listener.
   * If you do dot call deregister function, it will be auto called when component is destroied.
   * @param {Function} listener listener bind to LOCALE_CHANGE event.
   * @param {Boolean} immediate call listener immediately, useful for component property initialize
   * @returns {Function} deregister function to remove listener
   */
  [I18N_WATCH](listener, immediate) {
    const deregs = getOrCreateArrayProperty(
      this,
      I18N_LISTENER_DEREGISTERS
    );
    const unwatcher = i18nService.watch(() => {
      // bind component to listener's function context.
      listener.call(this);
    }, immediate);
    const deregister = () => {
      unwatcher();
      arrayRemove(deregs, deregister);
    };
    deregs.push(deregister);
    return deregister;
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
      // bind component to listener's function context.
      listener.call(this, $event);
    }, capture);

    const deregs = getOrCreateArrayProperty(this, DOM_LISTENER_DEREGISTERS);
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
    /*
     * once component is being destroied,
     *   we mark component and it's passed-attrs un-notifiable to ignore
     *   possible messeges occurs in BEFORE_DESTROY lifecycle callback.
     */
    this[VM_ATTRS][VM_NOTIFIABLE] = false;
    this[PASSED_ATTRS][VM_ATTRS][VM_NOTIFIABLE] = false;

    // notify before destroy lifecycle
    // 需要注意，必须先 NOTIFY 向外通知销毁消息，再执行 BEFORE_DESTROY 生命周期函数。
    //   因为在 BEFORE_DESTROY 里会销毁外部消息回调函数里可能会用到的属性等资源。
    this[NOTIFY](BEFORE_DESTROY_EVENT_NAME, this);
    this[BEFORE_DESTROY]();
    // destroy children(include child component and html nodes)
    this[HANDLE_BEFORE_DESTROY](removeDOM);
    // clear messenger listeners.
    super[CLEAR]();
    // remove component style
    StyleManager[CSTYLE_DEL](this.constructor.style);
    // destroy attrs passed to constructor
    const attrs = this[PASSED_ATTRS];
    attrs[VM_ATTRS][VM_DESTROY]();
    // unlink all symbol property. may be unnecessary.
    getOwnPropertySymbols(attrs, p => {
      attrs[p] = null;
    });

    /*
     * reset HOST object's all public properties to null
     *   to remove HOST object from old property value's VM_PARENTS
     *
     * 将所有公共属性的属性值重置为 null，从而解除 ViewModel 之间的 VM_PARENTS 关联，回收资源和防止潜在 bug。
     *   使用 getOwnPropertyNames 可以获取所有属性，但无法获取 setter 函数定义的属性。
     *   因此，先从 VM_SETTER_FN_MAP 中取到所有使用过的属性，主动调用属性值的 REMOVE_PARENT；然后使用 getOwnPropertyNames 简单地重置 null。
     */
    const sfm = this[VM_SETTER_FN_MAP];
    if (sfm) {
      sfm.forEach((fn, prop) => {
        if (fn === null) return;
        const v = this[prop];
        if (!isObject(v)) return;
        const va = v[VM_ATTRS];
        va && va[VM_REMOVE_PARENT](
          this[VM_ATTRS][VM_HOST],
          prop
        );
      });
      sfm.clear();
      this[VM_SETTER_FN_MAP] = null;
    }
    getOwnPropertyNames(this, prop => {
      if (isObject(this[prop])) {
        this[prop] = null;
      }
    });
    // destroy view model, it's import to pass false as argument
    this[VM_ATTRS][VM_DESTROY](false);

    // clear next tick update setImmediate
    const unm = this[UPDATE_NEXT_MAP];
    if (unm) {
      unm.forEach(imm => {
        clearImmediate(imm);
      });
      unm.clear();
      this[UPDATE_NEXT_MAP] = null;
    }

    // destroy related refs:
    destroyRelatedRefs(this);
    // clear context.
    destroyContext(this);
    // clear all dom event listener and i18n watcher
    releaseDeregisters(this, DOM_LISTENER_DEREGISTERS);
    releaseDeregisters(this, I18N_LISTENER_DEREGISTERS);

    // clear properties
    this[STATE] = STATE_DESTROIED;
    // unlink all symbol properties. maybe unnecessary.
    this[VM_SETTER_FN_MAP] =
      this[PASSED_ATTRS] =
      this[NON_ROOT_COMPONENT_NODES] =
      this[ROOT_NODES] =
      this[REF_NODES] =
      this[REF_BELONGS] =
      this[ARG_COMPONENTS] = null;
    // unlink VM_ATTRS, mark component destroied
    // 这行代码必须放在最后，因为在 ../viewmodel/proxy.js 里面，
    //   需要使用 VM_ATTRS 是否存在来判断组件是否已经销毁。
    this[VM_ATTRS] = null;
  }

  [HANDLE_BEFORE_DESTROY](removeDOM) {
    this[NON_ROOT_COMPONENT_NODES].forEach(component => {
      // it's not necessary to remove dom when destroy non-root component,
      // because those dom nodes will be auto removed when their parent dom is removed.
      component[DESTROY](false);
    });
    this[NON_ROOT_COMPONENT_NODES].length = 0;

    let $parent;
    this[ROOT_NODES].forEach(node => {
      if (isComponent(node)) {
        node[DESTROY](removeDOM);
      } else if (removeDOM) {
        if (!$parent) {
          $parent = getParent(node);
        }
        removeChild($parent, node);
      }
    });
    this[ROOT_NODES].length = 0;
  }

  [HANDLE_AFTER_RENDER]() {
    /*
     * Set NOTIFIABLE=true to enable ViewModel notify.
     * Don't forgot to add these code if you override HANDLE_AFTER_RENDER
     */
    this[PASSED_ATTRS][VM_ATTRS][VM_NOTIFIABLE] = true;
    this[VM_ATTRS][VM_NOTIFIABLE] = true;

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

    const ntMap = getOrCreateMapProperty(this, UPDATE_NEXT_MAP);
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
    const rns = getOrCreateMapProperty(this, REF_NODES);
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
      getOrCreateArrayProperty(el, REF_BELONGS).push([
        this, ref
      ]);
      return;
    }
    if (this === relatedComponent) {
      return;
    }
    getOrCreateArrayProperty(
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

function releaseDeregisters(component, nameOfDeregisters) {
  if (component[nameOfDeregisters]) {
    component[nameOfDeregisters].forEach(deregister => deregister());
    component[nameOfDeregisters] = null;
  }
}

export function destroyRelatedRefs(comp) {
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
  _unref(comp[REF_BELONGS], comp);
  _unref(comp[RELATED_DOM_REFS]);
}

export function isComponent(c) {
  return ROOT_NODES in c;
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
