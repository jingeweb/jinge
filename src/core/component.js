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
  VM_EMPTY_PARENTS
} from '../viewmodel/common';
import {
  Messenger
} from './messenger';
import {
  Symbol,
  isDOMNode,
  instanceOf,
  assert_fail,
  isFunction,
  STR_DEFAULT,
  isObject
} from '../util';
import {
  getParent,
  removeChild,
  replaceChild
} from '../dom';

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
export const RELATED_VM_LISTENERS = Symbol('related_vm_listeners');
export const RELATED_VM_ADD = Symbol('related_vm_add');
export const GET_STATE_NAME = Symbol('get_state_name');
export const UPDATE = Symbol('update');
export const UPDATE_IF_NEED = Symbol('update_if_need');
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
  return Object.assign({}, context);
}

export function onAfterRender(node) {
  if (!isComponent(node)) return; // skip html-node
  node[ROOT_NODES].forEach(onAfterRender);
  node[NON_ROOT_COMPONENT_NODES].forEach(onAfterRender);
  node[STATE] = STATE_RENDERED;
  node[CONTEXT_STATE] = -1; // has been rendered, can't modify context
  node.afterRender();
}

function removeRootNodes(component, $parent) {
  component[ROOT_NODES].forEach(node => {
    if (isComponent(node)) removeRootNodes(node, $parent);
    else {
      if (!$parent) $parent = getParent(node);
      removeChild($parent, node);
    }
  });
  component[ROOT_NODES] = null;
}

export class Component extends Messenger {
  /**
   * compiler will auto transform the `template` getter's return value from String to Render Function.
   */
  static get template() {
    return null;
  }
  constructor(attrs) {
    if (attrs === null || attrs === undefined) {
      // do nothing.
    } else if (isFunction(attrs)) {
      attrs = {
        [ARG_COMPONENTS]: {
          [STR_DEFAULT]: attrs
        }
      };
    } else if (isObject(attrs) && !(VM_PARENTS in attrs)) {
      throw new Error('First argument passed to Component constructor must be ViewModel');
    }
    super();
    this[VM_PARENTS] = VM_EMPTY_PARENTS;
    this[VM_LISTENERS] = {};
    this[CONTEXT] = attrs ? attrs[CONTEXT] : null;
    this[CONTEXT_STATE] = 0;
    this[ARG_COMPONENTS] = attrs ? (attrs[ARG_COMPONENTS] || null) : null;
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
    this[REF_NODES] = {};
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
    this[RELATED_VM_LISTENERS] = new Map();
  }
  [VM_ON](prop, handler, componentCtx) {
    vmAddListener(this, prop, handler);
    if (!componentCtx || !isComponent(componentCtx) || componentCtx === this) return;
    componentCtx[RELATED_VM_ADD](this, prop, handler);
  }
  [RELATED_VM_ADD](vm, prop, handler) {
    let hook = this[RELATED_VM_LISTENERS].get(vm);
    if (!hook) {
      hook = [];
      this[RELATED_VM_LISTENERS].set(vm, hook);
    }
    hook.push([prop, handler]);
  }
  [VM_OFF](prop, handler) {
    return vmRemoveListener(this, prop, handler);
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
    let renderFn = this.constructor.template;
    if (!renderFn && this[ARG_COMPONENTS]) {
      renderFn = this[ARG_COMPONENTS][STR_DEFAULT];
    }
    if (!isFunction(renderFn)) assert_fail();
    return renderFn(this);
  }
  [RENDER_TO_DOM]($targetDOM) {
    if (!isDOMNode($targetDOM)) assert_fail();
    if (this[STATE] !== STATE_INITIALIZE) {
      assert_fail();
    }
    replaceChild(getParent($targetDOM), this[RENDER](), $targetDOM);
    onAfterRender(this);
  }
  [DESTROY](removeDOM = true) {
    if (this[STATE] > STATE_WILLDESTROY) return;
    this[STATE] = STATE_WILLDESTROY;
    this.beforeDestroy();
    super.clear();   // dont forgot call super clear.
    this[VM_CLEAR](); // dont forgot clear vm listeners
    destroyRelatedVMListeners(this);
    this[NON_ROOT_COMPONENT_NODES].forEach(component => {
      component[DESTROY](false);
    });
    this[ROOT_NODES].forEach(node => {
      if (isComponent(node)) node[DESTROY](false);
    });
    this[STATE] = STATE_DESTROIED;
    this[RELATED_VM_LISTENERS] =
      this[NON_ROOT_COMPONENT_NODES] =
      this[REF_NODES] =
      this[ARG_COMPONENTS] =
      this[CONTEXT] = null;
    
    if (removeDOM) {
      removeRootNodes(this);
    }
  }
  [UPDATE_IF_NEED]() {
    if (this[STATE] === STATE_RENDERED) {
      this[UPDATE]();
    }
  }
  [UPDATE]() {
    throw new Error('abstract method');
  }
  [GET_STATE_NAME]() {
    return STATE_NAMES[this[STATE]];
  }
  setContext(id, ctx, forceOverride = false) {
    if (this[CONTEXT_STATE] < 0) {
      throw new Error('Can\'t setContext after component has been rendered. Try put setContext code into constructor.');
    }
    if (this[CONTEXT_STATE] === 0) {
      // we copy context to make sure child component do not modify context passed from parent.
      // we do not copy it by default until setContext function is called, because it unnecessary to waste memory if
      // child component do not modify the context.
      if (!this[CONTEXT]) {
        this[CONTEXT] = {};
      } else {
        this[CONTEXT] = copyContext(this[CONTEXT]);
      }
      this[CONTEXT_STATE] = 1; // has been copied.
    }
    if (id in this[CONTEXT]) {
      // override exist may case hidden bug hard to debug.
      // so we force programmer to pass third argument to 
      //   tell us he/she know what he/she is doing.
      if (!forceOverride) throw new Error(`Contenxt with id: ${id} is exist. Pass third argument forceOverride=true to override it.`);
    }
    this[CONTEXT][id] = ctx;
  }
  getContext(id) {
    if (!this[CONTEXT]) return null;
    return this[CONTEXT][id] || null;
  }
  getChild(ref) {
    return this[REF_NODES][ref] || null;
  }
  afterRender() {
    // life time hook
  }
  beforeDestroy() {
    // life time hook
  }
}

export function destroyRelatedVMListeners(comp) {
  comp[RELATED_VM_LISTENERS].forEach((hooks, ctx) => {
    hooks.forEach(hook => {
      ctx[VM_OFF](hook[0], hook[1]);
    });
    hooks.length = 0;
  });
  comp[RELATED_VM_LISTENERS].clear();
}

export function isComponent(c) {
  return instanceOf(c, Component);
}

