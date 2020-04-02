import { $$, ViewModelCore, ViewModelObject } from '../vm/common';
import { Messenger, MessengerHandler } from './messenger';
import { WatchOptions } from './i18n';
export declare enum ComponentStates {
    INITIALIZE = 0,
    RENDERED = 1,
    WILLDESTROY = 2,
    DESTROIED = 3
}
export declare enum ContextStates {
    UNTOUCH = 0,
    TOUCHED = 1,
    UNTOUCH_FREEZED = 2,
    TOUCHED_FREEZED = 3
}
export declare const __: unique symbol;
export declare type DeregisterFn = () => void;
export declare type RenderFn = (comp: Component) => Node[];
interface CompilerAttributes {
    context?: Record<string, unknown>;
    /**
     * parent inherit component styles
     */
    compStyle?: Record<string, string>;
    slots?: Record<string, RenderFn>;
    listeners?: Record<string, MessengerHandler>;
}
export declare type ComponentAttributes = ViewModelObject & {
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
export declare function isComponent(v: object): boolean;
export declare function assertRenderResults(renderResults: Node[]): Node[];
declare function wrapAttrs<T extends {
    [__]?: CompilerAttributes;
}>(target: T): T & ViewModelObject;
export { wrapAttrs as attrs };
export declare class Component extends Messenger {
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
    static create<T extends Component>(this: {
        new (attrs: ComponentAttributes): T;
    }, attrs?: Record<string, unknown> | ComponentAttributes): T;
    [__]: ComponentProperties;
    [$$]: ViewModelCore;
    /**
     * ATTENTION!!!
     *
     * Don't use constructor directly, use static factory method `create(attrs)` instead.
     */
    constructor(attrs: ComponentAttributes);
    /**
     * Helper function to add i18n change listener.
     * Return deregister function which will remove event listener.
     * If you do dot call deregister function, it will be auto called when component is destroied.
     */
    __i18nWatch(listener: (locale: string) => void, immediate?: boolean): DeregisterFn;
    __i18nWatch(listener: (locale: string) => void, options?: WatchOptions): DeregisterFn;
    /**
     * Helper function to add dom event listener.
     * Return deregister function which will remove event listener.
     * If you do dot call deregister function, it will be auto called when component is destroied.
     * @param {Boolean|Object} capture
     * @returns {Function} deregister function to remove listener
     */
    __domAddListener($el: HTMLElement, eventName: string, listener: EventListener, capture?: boolean | AddEventListenerOptions): DeregisterFn;
    /**
     * Helper function to pass all listener to target dom element.
     * By default target dom element is first
     * @param {Array} ignoredEventNames event names not passed
     */
    __domPassListeners(ignoredEventNames?: string[]): void;
    __domPassListeners(targetEl?: HTMLElement): void;
    __domPassListeners(ignoredEventNames: string[], targetEl: HTMLElement): void;
    /**
     * Get rendered DOM Node which should be apply transition.
     *
     * 返回在 transition 动画时应该被应用到的 DOM 节点。
     */
    get __transitionDOM(): Node;
    /**
     * Get first rendered DOM Node after Component is rendered.
     *
     * 按从左往右从上到下的深度遍历，找到的第一个 DOM 节点。
     */
    get __firstDOM(): Node;
    /**
     * Get last rendered DOM Node after Component is rendered.
     *
     * 按从右往左，从上到下的深度遍历，找到的第一个 DOM 节点（相对于从左到右的顺序是最后一个 DOM 节点）。
     */
    get __lastDOM(): Node;
    /**
     * 对模板进行渲染的函数，也可能是渲染编译器传递进来的默认渲染函数。
     * 如果子组件需要进行自定义的渲染行为，需要重载该函数。
     */
    __render(): Node[];
    /**
     * Render Component to HTMLElement.
     * This method is usually used to render the entire application.
     * See the `bootstrap()` function in `./bootstrap.js`.
     *
     * By default, the target element will be replaced(that means deleted).
     * But you can disable it by pass `replaceMode`=`false`,
     * which means component append to target as it's children.
     */
    __renderToDOM(targetEl: HTMLElement, replaceMode?: boolean): void;
    __destroy(removeDOM?: boolean): void;
    __handleBeforeDestroy(removeDOM?: boolean): void;
    __handleAfterRender(): void;
    __updateIfNeed(nextTick?: boolean): void;
    __updateIfNeed(handler: () => void, nextTick?: boolean): void;
    __update(first?: boolean): void;
    __setContext(key: string | symbol, value: unknown, forceOverride?: boolean): void;
    __getContext(key: string | symbol): unknown;
    /**
     * This method is used for compiler generated code.
     * Do not use it manually.
     */
    __setRef(ref: string, el: Component | Node, relatedComponent?: Component): void;
    /**
     * Get child node(or nodes) marked by 'ref:' attribute in template
     */
    __getRef(ref: string): Component | Node | (Component | Node)[];
    /**
     * lifecycle hook, called after rendered.
     */
    __afterRender(): void;
    /**
     * lifecycle hook, called before destroy.
     */
    __beforeDestroy(): void;
}
