import {
  isObject, isArray, arrayRemove, registerEvent,
  isFunction, clearImmediate, setImmediate,
  appendChildren, replaceChildren, warn
} from '../util';
import {
  $$, ViewModelCore, ViewModelObject
} from '../vm/common';
import {
  createComponent, createAttributes
} from '../vm/proxy';
import {
  Messenger, MESSENGER_LISTENERS, MessengerHandler
} from './messenger';
import {
  manager as StyleManager, ComponentStyle
} from './style';
import {
  i18n as i18nService, WatchOptions
} from './i18n';

export enum ComponentStates {
  INITIALIZE = 0,
  RENDERED = 1,
  WILLDESTROY = 2,
  DESTROIED = 3
}
export enum ContextStates {
  UNTOUCH = 0,
  TOUCHED = 1,
  UNTOUCH_FREEZED = 2,
  TOUCHED_FREEZED = 3
}
export const __ = Symbol('__');

export type DeregisterFn = () => void;
export type RenderFn = (comp: Component) => Node[];

interface CompilerAttributes {
  context?: Record<string, unknown>;
  /**
   * parent inherit component styles
   */
  compStyle?: Record<string, string>;
  slots?: Record<string, RenderFn>;
  listeners?: Record<string, MessengerHandler>;
}
export type ComponentAttributes = ViewModelObject & {
  [__]?: CompilerAttributes;
};

export interface ComponentProperties {
  /**
   * 将构造函数传递来的 attrs 存下来，以便可以在后期使用，以及在组件销毁时销毁该 attrs。
   */
  passedAttrs: ComponentAttributes;
  /**
   * 组件的上下文对象
   */
  context: Record<string | symbol, unknown>;
  contextState: ContextStates;
  /**
   * 编译器传递进来的渲染函数，跟 WebComponent 里的 Slot 概念类似。
   */
  slots: Record<string, RenderFn> & {
    default?: RenderFn;
  };
  /**
   * 组件的状态
   */
  state: ComponentStates;
  /**
   * ROOT_NODES means root children of this component,
   *   include html-nodes and component-nodes.
   * We use this infomation to remove DOM after this component is destroied.
   * We do not maintain the whole parent-child view-tree but only root children,
   * because when we remove the root children, whole view-tree will be
   * removed, so we do not need waste memory to maintain whole view-tree.
   */
  rootNodes: (Component | Node)[];
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
  nonRootCompNodes: Component[];
  /**
   * refs contains all children with ref: attribute.
   *
   * 使用 ref: 标记的元素（Component 或 html node），会保存在 REF_NODES 中，
   *   之后通过 __getRef 函数可以获取到元素实例。
   */
  refs: Map<string, Component | Node | (Component | Node)[]>;
  /**
   * 当被 ref: 标记的元素属于 <if> 或 <for> 等组件的 slot 时，这些元素被添加到当前模板组件（称为 origin component)的 refs 里，
   *   但显然当 <if> 元素控制销毁时，也需要将这个元素从 origin component 的 refs 中删除，
   *   否则 origin component 中通过 __getRef 还能拿到这个已经被销毁的元素。
   * 
   * 为了实现这个目的，会在将 ref: 标记的元素添加到模板组件 refs 中时，同时也添加到 relatedRefs 中，
   *   这样，在关联节点（比如受 <if> 控制的元素，或 <if> 下面的 DOM 节点）被销毁时，
   *   也会从模板组件的 refs 里面删除。
   */
  relatedRefs: {
    origin: Component;
    ref: string;
    node?: Node;
  }[];
  /**
   * component styles, include styles inherits from parent.
   */
  compStyle: Record<string, string>;
  /**
   * update-next-map
   */
  upNextMap: Map<(() => void) | number, number>;
  /**
   * dom listeners deregister
   */
  deregDOM: DeregisterFn[];
  /**
   * i18n watchers deregister
   */
  deregI18N: DeregisterFn[];
}

/** Bellow is utility functions **/
 
export function isComponent(v: object): boolean {
  return __ in v;
}

export function assertRenderResults(renderResults: Node[]): Node[] {
  if (!isArray(renderResults) || renderResults.length === 0) {
    throw new Error('Render results of component is empty');
  }
  return renderResults;
}

function wrapAttrs<T extends {
  [__]?: CompilerAttributes;
}>(target: T): T & ViewModelObject {
  if (!isObject(target) || isArray(target)) {
    throw new Error('attrs() traget must be plain object.');
  }
  return createAttributes<T>(target);
}
export {wrapAttrs as attrs};

export class Component extends Messenger {

  /**
   * 指定组件的渲染模板。务必使用 getter 的形式指定，例如：
   * ````js
   * class SomeComponent extends Component {
   *   static get template() {
   *     return '<p>hello, world</p>';
   *   }
   * }
   * ````
   */
  static readonly template: string;
  /**
   * 指定组件的样式。务必使用 getter 的形式指定，例如：
   * ````js
   * class SomeComponent extends Component {
   *   static get style() {
   *     return `
   * .some-class {
   *   color: red;
   * }`;
   *   }
   * }
   * ````
   */
  static readonly style: string;

  /**
   * 某些情况下，需要判断一个函数是否是组件的构造函数。添加一个静态成员属性符号用于进行该判断。
   * isComponent 函数既可以判断是否是构造函数（配合 isFunction），又可以判断一个对像是否是组件实例。
   * 
   * 示例：
   * 
   * ````js
   * import { isComponent, Component } from 'jinge';
   * 
   * class A {};
   * class B extends Component {};
   * console.log(isComponent(A)); // false
   * console.log(isComponent(B)); // true
   * ````
   */
  static readonly [__] = true;

  static create<T extends Component>(this: { new(attrs: ComponentAttributes): T }, attrs?: Record<string, unknown> | ComponentAttributes): T {
    attrs = attrs || wrapAttrs({});
    if (!isObject(attrs) || !($$ in attrs)) {
      attrs = wrapAttrs(attrs || {});
    }
    return (new this(attrs as ComponentAttributes))[$$].proxy as T;
  }

  /* 使用 symbol 来定义属性，避免业务层无意覆盖了支撑 jinge 框架逻辑的属性带来坑 */

  [__]: ComponentProperties;
  [$$]: ViewModelCore;

  /**
   * ATTENTION!!!
   * 
   * Don't use constructor directly, use static factory method `create(attrs)` instead.
   */
  constructor(attrs: ComponentAttributes) {
    if (!isObject(attrs) || !($$ in attrs)) {
      throw new Error('Attributes passed to Component constructor must be ViewModel. See https://[todo]');
    }
    const compilerAttrs = attrs[__] || {};
    super(compilerAttrs.listeners);
    createComponent(this);

    this[__] = {
      passedAttrs: attrs,
      context: compilerAttrs.context || null,
      contextState: ContextStates.UNTOUCH,
      slots: compilerAttrs.slots,
      state: ComponentStates.INITIALIZE,
      rootNodes: [],
      nonRootCompNodes: [],
      refs: null,
      relatedRefs: null,
      upNextMap: null,
      compStyle: compilerAttrs.compStyle || null,
      deregDOM: null,
      deregI18N: null
    };
  }

  /**
   * Helper function to add i18n change listener.
   * Return deregister function which will remove event listener.
   * If you do dot call deregister function, it will be auto called when component is destroied.
   */
  __i18nWatch(listener: (locale: string) => void, immediate?: boolean): DeregisterFn;
  __i18nWatch(listener: (locale: string) => void, options?: WatchOptions): DeregisterFn;
  __i18nWatch(listener: (locale: string) => void, opts?: boolean | WatchOptions): DeregisterFn {
    let deregs = this[__].deregI18N;
    if (!deregs) {
      this[__].deregI18N = deregs = [];
    }
    const unwatcher = i18nService.watch(() => {
      // bind component to listener's function context.
      listener.call(this);
    }, opts as WatchOptions);
    const deregister = (): void => {
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
   * @param {Boolean|Object} capture
   * @returns {Function} deregister function to remove listener
   */
  __domAddListener($el: HTMLElement, eventName: string, listener: EventListener, capture?: boolean | AddEventListenerOptions): DeregisterFn {
    let deregs = this[__].deregDOM;
    if (!deregs) {
      this[__].deregDOM = deregs = [];
    }
    const lisDeregister = registerEvent($el, eventName, $event => {
      // bind component to listener's function context.
      listener.call(this, $event);
    }, capture);
    const deregister = (): void => {
      lisDeregister();
      arrayRemove(deregs, deregister);
    };
    deregs.push(deregister);
    return deregister;
  }

  /**
   * Helper function to pass all listener to target dom element.
   * By default target dom element is first
   * @param {Array} ignoredEventNames event names not passed
   */
  __domPassListeners(ignoredEventNames?: string[]): void;
  __domPassListeners(targetEl?: HTMLElement): void;
  __domPassListeners(ignoredEventNames: string[], targetEl: HTMLElement): void;
  __domPassListeners(ignoredEventNames?: string[] | HTMLElement, targetEl?: HTMLElement): void {
    if (this[__].state !== ComponentStates.RENDERED) {
      throw new Error('domPassListeners must be applied to component which is rendered.');
    }
    const lis = this[MESSENGER_LISTENERS];
    if (!lis || lis.size === 0) {
      return;
    }
    if (ignoredEventNames && !isArray(ignoredEventNames)) {
      targetEl = ignoredEventNames as HTMLElement;
      ignoredEventNames = null;
    } else if (!targetEl) {
      targetEl = this.__firstDOM as unknown as HTMLElement;
    }
    if (targetEl.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    lis.forEach((handlers, eventName) => {
      if (ignoredEventNames && (ignoredEventNames as string[]).indexOf(eventName) >= 0) {
        return;
      }
      handlers.forEach(handler => {
        const {opts, fn} = handler;
        this.__domAddListener(targetEl, eventName, (
          handler.opts && (handler.opts.stop || handler.opts.prevent)
          ? function($evt: Event): void {
            opts.stop && $evt.stopPropagation();
            opts.prevent && $evt.preventDefault();
            // this.domAddListener 会将 this 变成当前组件。所以需要显式地使用 fn.call(this) 来传递组件。
            fn.call(this, $evt);
          } : fn
        ), handler.opts as unknown as AddEventListenerOptions);
      });
    });
  }

  /**
   * Get rendered DOM Node which should be apply transition.
   * 
   * 返回在 transition 动画时应该被应用到的 DOM 节点。
   */
  get __transitionDOM(): Node {
    const el = this[__].rootNodes[0];
    return isComponent(el) ? (el as Component).__transitionDOM : el as Node;
  }

  /**
   * Get first rendered DOM Node after Component is rendered.
   * 
   * 按从左往右从上到下的深度遍历，找到的第一个 DOM 节点。
   */
  get __firstDOM(): Node {
    const el = this[__].rootNodes[0];
    return isComponent(el) ? (el as Component).__firstDOM : el as Node;
  }

  /**
   * Get last rendered DOM Node after Component is rendered.
   * 
   * 按从右往左，从上到下的深度遍历，找到的第一个 DOM 节点（相对于从左到右的顺序是最后一个 DOM 节点）。
   */
  get __lastDOM(): Node {
    const rns = this[__].rootNodes;
    const el = rns[rns.length - 1];
    return isComponent(el) ? (el as Component).__lastDOM : el as Node;
  }

  /**
   * 对模板进行渲染的函数，也可能是渲染编译器传递进来的默认渲染函数。
   * 如果子组件需要进行自定义的渲染行为，需要重载该函数。
   */
  __render(): Node[] {
    const Clazz = this.constructor as typeof Component;
    let renderFn = Clazz.template as unknown as RenderFn; // jinge-loader 已经将 string 转成了 RenderFn，此处强制转换类型以绕开 typescript.
    if (!renderFn && this[__].slots) {
      renderFn = this[__].slots.default;
    }
    if (!isFunction(renderFn)) {
      throw new Error(`Template of ${Clazz.name} not found. Forget static getter "template"?`);
    }
    StyleManager.add(Clazz.style as unknown as ComponentStyle); // jinge-loader 已经将 string 转成了 ComponentStyle，此处强制转换类型以绕开 typescript.
    return renderFn(this);
  }

  /**
   * Render Component to HTMLElement. 
   * This method is usually used to render the entire application.
   * See the `bootstrap()` function in `./bootstrap.js`.
   * 
   * By default, the target element will be replaced(that means deleted).
   * But you can disable it by pass `replaceMode`=`false`,
   * which means component append to target as it's children.
   */
  __renderToDOM(targetEl: HTMLElement, replaceMode = true): void {
    if (this[__].state !== ComponentStates.INITIALIZE) {
      throw new Error('component has already been rendered.');
    }
    const rr = assertRenderResults(this.__render());
    StyleManager.attch();
    if (replaceMode) {
      replaceChildren(targetEl.parentNode, rr, targetEl);
    } else {
      appendChildren(targetEl, rr);
    }
    this.__handleAfterRender();
  }

  __destroy(removeDOM = true): void {
    const comp = this[__];
    if (comp.state > ComponentStates.WILLDESTROY) return;
    comp.state = ComponentStates.WILLDESTROY;
    /*
     * once component is being destroied,
     *   we mark component and it's passed-attrs un-notifiable to ignore
     *   possible messeges occurs in BEFORE_DESTROY lifecycle callback.
     */
    this[$$].__notifiable = false;
    comp.passedAttrs[$$].__notifiable = false;

    // notify before destroy lifecycle
    // 需要注意，必须先 NOTIFY 向外通知销毁消息，再执行 BEFORE_DESTROY 生命周期函数。
    //   因为在 BEFORE_DESTROY 里会销毁外部消息回调函数里可能会用到的属性等资源。
    this.__notify('before-destroy');
    this.__beforeDestroy();
    // destroy children(include child component and html nodes)
    this.__handleBeforeDestroy(removeDOM);
    // clear messenger listeners.
    super.__off();
    // remove component style
    StyleManager.remove((this.constructor as typeof Component).style as unknown as ComponentStyle);
    // destroy attrs passed to constructor
    comp.passedAttrs[$$].__destroy();
    comp.passedAttrs = null;
    // destroy view model
    this[$$].__destroy();

    // clear next tick update setImmediate
    if (comp.upNextMap) {
      comp.upNextMap.forEach(imm => {
        clearImmediate(imm);
      });
      comp.upNextMap = null;
    }

    // destroy related refs:
    if (comp.relatedRefs) {
      comp.relatedRefs.forEach(info => {
        const refs = info.origin[__].refs;
        if (!refs) return;
        const rns = refs.get(info.ref);
        if (isArray(rns)) {
          arrayRemove(rns as (Component | Node)[], info.node || this);
        } else {
          refs.delete(info.ref);
        }
      });
      comp.relatedRefs = null;
    } 
    // clear all dom event listener and i18n watcher
    if (comp.deregDOM) {
      comp.deregDOM.forEach(deregFn => deregFn());
      comp.deregDOM = null;
    }
    if (comp.deregI18N) {
      comp.deregI18N.forEach(deregFn => deregFn());
      comp.deregI18N = null;
    }

    // clear properties
    comp.state = ComponentStates.DESTROIED;
    // unlink all symbol properties. maybe unnecessary.
    comp.rootNodes = comp.nonRootCompNodes =
      comp.refs = comp.slots = comp.context = null;
  }

  __handleBeforeDestroy(removeDOM = false): void {
    this[__].nonRootCompNodes.forEach(component => {
      // it's not necessary to remove dom when destroy non-root component,
      // because those dom nodes will be auto removed when their parent dom is removed.
      component.__destroy(false);
    });

    let $parent: Node;
    this[__].rootNodes.forEach(node => {
      if (isComponent(node)) {
        (node as Component).__destroy(removeDOM);
      } else if (removeDOM) {
        if (!$parent) {
          $parent = (node as Node).parentNode;
        }
        $parent.removeChild(node as Node);
      }
    });
  }

  __handleAfterRender(): void {
    /*
     * Set NOTIFIABLE=true to enable ViewModel notify.
     * Don't forgot to add these code if you override HANDLE_AFTER_RENDER
     */
    this[__].passedAttrs[$$].__notifiable = true;
    this[$$].__notifiable = true;

    this[__].rootNodes.forEach(n => {
      if (isComponent(n)) (n as Component).__handleAfterRender();
    });
    this[__].nonRootCompNodes.forEach(n => {
      if (isComponent(n)) (n as Component).__handleAfterRender();
    });
    this[__].state = ComponentStates.RENDERED;
    this[__].contextState = this[__].contextState === ContextStates.TOUCHED ? ContextStates.TOUCHED_FREEZED : ContextStates.UNTOUCH_FREEZED; // has been rendered, can't modify context
    this.__afterRender();
    this.__notify('after-render');
  }

  __updateIfNeed(nextTick?: boolean): void;
  __updateIfNeed(handler: () => void, nextTick?: boolean): void;
  __updateIfNeed(handler?: (() => void) | boolean, nextTick: boolean = true): void {
    if (this[__].state !== ComponentStates.RENDERED) {
      return;
    }
    if (handler === false) {
      return this.__update();
    }

    if (!isFunction(handler)) {
      handler = this.__update;
    }

    if (!nextTick) {
      (handler as () => void).call(this);
      return;
    }

    let ntMap = this[__].upNextMap;
    if (!ntMap) ntMap = this[__].upNextMap = new Map();
    if (ntMap.has(handler as () => void)) {
      // already in queue.
      return;
    }
    ntMap.set(handler as () => void, setImmediate(() => {
      ntMap.delete(handler as () => void);
      (handler as () => void).call(this);
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  __update(first?: boolean): void {
    // by default, do nothing.
  }

  __setContext(key: string | symbol, value: unknown, forceOverride = false): void {
    if (this[__].contextState === ContextStates.UNTOUCH_FREEZED || this[__].contextState === ContextStates.TOUCHED_FREEZED) {
      throw new Error('Can\'t setContext after component has been rendered. Try put setContext code into constructor.');
    }
    if (this[__].contextState === ContextStates.UNTOUCH) {
      // we copy context to make sure child component do not modify context passed from parent.
      // we do not copy it by default until setContext function is called, because it unnecessary to waste memory if
      // child component do not modify the context.
      this[__].context = Object.assign({}, this[__].context);
      this[__].contextState = ContextStates.TOUCHED; // has been copied.
    }
    if (key in this[__].context) {
      // override exist may case hidden bug hard to debug.
      // so we force programmer to pass third argument to
      //   tell us he/she know what he/she is doing.
      if (!forceOverride) {
        throw new Error(`Contenxt with key: ${key.toString()} is exist. Pass third argument forceOverride=true to override it.`);
      }
    }
    this[__].context[key as string] = value;
  }

  __getContext(key: string | symbol): unknown {
    return this[__].context ? this[__].context[key as string] : null;
  }

  /**
   * This method is used for compiler generated code.
   * Do not use it manually.
   */
  __setRef(ref: string, el: Component | Node, relatedComponent?: Component): void {
    let rns = this[__].refs;
    if (!rns) {
      this[__].refs = rns = new Map();
    }
    let elOrArr = rns.get(ref);
    if (!elOrArr) {
      rns.set(ref, el);
    } else if (isArray(elOrArr)) {
      (elOrArr as (Component | Node)[]).push(el);
    } else {
      elOrArr = [elOrArr as Component, el];
      rns.set(ref, elOrArr);
    }
    const isComp = isComponent(el);
    if (!isComp && this === relatedComponent) {
      return;
    }
    /**
     * 如果被 ref: 标记的元素（el）本身就是组件（Component）节点，
     *   那么 el 自身就是关联组件，el 自身在被销毁时可以执行删除关联 refs 的操作；
     * 如果 el 是 DOM 节点，则必须将它添加到关联组件（比如 <if>） relatedComponent 里，
     *   在 relatedComponent 被销毁时执行关联 refs 的删除。
     */
    let rbs = ((isComp ? el : relatedComponent) as Component)[__].relatedRefs;
    if (!rbs) {
      ((isComp ? el : relatedComponent) as Component)[__].relatedRefs = rbs = [];
    }
    rbs.push({
      origin: this,
      ref,
      node: isComp ? null : el as Node
    });
  }

  /**
   * Get child node(or nodes) marked by 'ref:' attribute in template
   */
  __getRef(ref: string): Component | Node | (Component | Node)[] {
    if (this[__].state !== ComponentStates.RENDERED) {
      warn(`Warning: call __getRef before component '${this.constructor.name}' rendered will get nothing. see https://[TODO]`);
    }
    return this[__].refs ? this[__].refs.get(ref) : null;
  }
  /**
   * lifecycle hook, called after rendered.
   */
  __afterRender(): void {
    // lifecycle hook, default do nothing.
  }

  /**
   * lifecycle hook, called before destroy.
   */
  __beforeDestroy(): void {
    // lifecycle hook, default do nothing.
  }
}
