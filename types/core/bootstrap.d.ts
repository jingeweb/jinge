import { Component, ComponentAttributes } from './component';
export declare function bootstrap<T extends Component & {
    create(attrs: object): T;
}>(ComponentClazz: T, dom: HTMLElement, attrs?: ComponentAttributes): T;
