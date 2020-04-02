import { ViewModelObject, ViewModelWatchHandler, PropertyPathItem } from './common';
export declare function vm<T extends object>(target: T): T & ViewModelObject;
export declare function watch(vm: ViewModelObject, property: PropertyPathItem, handler: ViewModelWatchHandler): void;
export declare function watch(vm: ViewModelObject, propertyStringPath: string, handler: ViewModelWatchHandler): void;
export declare function watch(vm: ViewModelObject, propertyArrayPath: PropertyPathItem[], handler: ViewModelWatchHandler): void;
export declare function unwatch(vm: ViewModelObject): void;
export declare function unwatch(vm: ViewModelObject, property: PropertyPathItem, handler?: ViewModelWatchHandler): void;
export declare function unwatch(vm: ViewModelObject, propertyStringPath: string, handler?: ViewModelWatchHandler): void;
export declare function unwatch(vm: ViewModelObject, propertyArrayPath: PropertyPathItem[], handler?: ViewModelWatchHandler): void;
