export declare type MessengerListener = (...args: unknown[]) => void;
export interface MessengerListenerOptions {
    capture?: boolean;
    passive?: boolean;
    once?: boolean;
    stop?: boolean;
    prevent?: boolean;
    prepend?: boolean;
}
export interface MessengerHandler {
    fn: MessengerListener;
    opts?: MessengerListenerOptions;
}
export declare const MESSENGER_LISTENERS: unique symbol;
export declare class Messenger {
    [MESSENGER_LISTENERS]: Map<string, MessengerHandler[]>;
    constructor(templateListeners?: Record<string, MessengerHandler>);
    __notify(eventName: string, ...args: unknown[]): void;
    __on(eventName: string, eventListener: MessengerListener, options?: MessengerListenerOptions): void;
    /**
     * clear all event listeners.
     */
    __off(): void;
    /**
     * clear all event listeners bind on special event name.
     */
    __off(eventName: string): void;
    /**
     * clear special event listener bind on special event name.
     */
    __off(eventName: string, eventListener: MessengerListener): void;
}
