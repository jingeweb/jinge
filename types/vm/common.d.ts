export declare const $$: unique symbol;
export declare type ViewModelWatchHandler = (propertyPath: PropertyPathItem[]) => void;
export declare type PropertyPathItem = string | number;
export interface ViewModelNode {
    __listeners: Map<string, ViewModelNode>;
    __parent?: ViewModelNode;
    __property?: string;
    __handlers?: ViewModelWatchHandler[];
}
export interface ViewModelCore {
    __parents: ViewModelParent[];
    __notifiable: boolean;
    __related: RelatedListenersMap;
    __setters: Map<string | symbol, Function>;
    proxy: unknown;
    target: object;
    __watch(propertyPath?: string | PropertyPathItem | PropertyPathItem[], handler?: ViewModelWatchHandler, related?: ViewModelCore): void;
    __unwatch(propertyPath?: string | PropertyPathItem | PropertyPathItem[], handler?: ViewModelWatchHandler, related?: ViewModelCore): void;
    __notify(propertyArrayPath: string | PropertyPathItem | PropertyPathItem[], immediate?: boolean): void;
    __addRelated(origin: ViewModelCore, propertyPath: PropertyPathItem | PropertyPathItem[], handler: ViewModelWatchHandler): void;
    __rmRelated(origin: ViewModelCore, propertyPath: PropertyPathItem | PropertyPathItem[], handler: ViewModelWatchHandler): void;
    __destroy(): void;
}
export declare type RelatedListenersMap = Map<ViewModelCore, {
    prop: string | PropertyPathItem | PropertyPathItem[];
    handler: ViewModelWatchHandler;
}[]>;
export interface ViewModelObject extends Record<string | number | symbol, unknown> {
    [$$]: ViewModelCore;
}
export declare type ViewModelArray = ViewModelObject & ViewModelObject[];
export declare type ViewModelParent = {
    core: ViewModelCore;
    prop: string | number;
};
export declare function isInnerObj(v: unknown): boolean;
export declare function isViewModel(v: unknown): boolean;
export declare function isPublicProperty(v: unknown): boolean;
