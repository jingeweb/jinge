import { Component, ComponentAttributes } from './component';
export declare function bootstrap<T extends (typeof Component) & {
    create(attrs: object): Component;
}>(ComponentClazz: T, dom: HTMLElement, attrs?: ComponentAttributes): InstanceType<T>;
