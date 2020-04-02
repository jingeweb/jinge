export declare function setText($element: Node, text: unknown): void;
export declare function createTextNode(text?: unknown): Text;
export declare function createFragment(children?: (Node | string)[]): DocumentFragment;
export declare function appendChildren($parent: Node, children: (Node | string)[]): void;
export declare function replaceChildren($parent: Node, children: Node[], oldNode: Node): void;
export declare function removeAttribute($ele: Element, attrName: string): void;
export declare function setAttribute($ele: Element, attrName: string, attrValue: unknown): void;
export declare function createElement(tag: string, attrs: Record<string, unknown>, ...children: (Node | string)[]): Element;
export declare function createElementWithoutAttrs(tag: string, ...children: (Node | string)[]): Element;
export declare function createSVGElement(tag: string, attrs: Record<string, unknown>, ...children: Node[]): Element;
export declare function createSVGElementWithoutAttrs(tag: string, ...children: Node[]): Element;
export declare function createElementWithChild(tag: string, attrs: Record<string, unknown>, child: Node | string): Element;
export declare function insertAfter($parent: Node, newNode: Node, referenceNode: Node): void;
export declare function addEvent($element: Element, eventName: string, handler: EventListener, capture?: boolean | AddEventListenerOptions): void;
export declare function removeEvent($element: Element, eventName: string, handler: EventListener): void;
/**
 * Add event to DOM element, similar as addEventListener,
 * but return deregister function which will call removeEventListener.
 *
 * @returns {Function} deregister function which will removeEventListener
 */
export declare function registerEvent($element: Element, eventName: string, handler: EventListener, capture?: boolean | AddEventListenerOptions): () => void;
