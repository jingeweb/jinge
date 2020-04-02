import { Component } from './component';
export declare function emptyRenderFn(component: Component): Node[];
export declare function errorRenderFn(component: Component): Node;
export declare function textRenderFn(component: Component, txtContent: unknown): Node;
export declare function i18nRenderFn(component: Component, key: string, isRoot?: boolean): Node;
