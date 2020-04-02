import { ViewModelNode, ViewModelParent, PropertyPathItem, ViewModelWatchHandler, ViewModelCore, RelatedListenersMap } from './common';
export declare class ViewModelCoreImpl implements ViewModelNode, ViewModelCore {
    __parents: ViewModelParent[];
    __listeners: Map<string, ViewModelNode>;
    __notifiable: boolean;
    __related: RelatedListenersMap;
    __setters: Map<string | symbol, Function>;
    target: object;
    proxy: unknown;
    /**
     * Don't use the constructor. Use createViewModel instead.
     */
    constructor(target: object);
    __watch(propertyPath: string | PropertyPathItem | PropertyPathItem[], handler: ViewModelWatchHandler, related?: ViewModelCore): void;
    __unwatch(propertyPath?: string | PropertyPathItem | PropertyPathItem[], handler?: ViewModelWatchHandler, related?: ViewModelCore): void;
    __notify(propertyPath: string | PropertyPathItem[], immediate?: boolean): void;
    __destroy(): void;
    __addRelated(origin: ViewModelCoreImpl, propertyPath: PropertyPathItem | PropertyPathItem[], handler: ViewModelWatchHandler): void;
    __rmRelated(origin: ViewModelCoreImpl, propertyPath: PropertyPathItem | PropertyPathItem[], handler: ViewModelWatchHandler): void;
}
