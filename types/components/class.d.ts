import { Component, ComponentAttributes } from '../core/component';
import { TransitionStates } from '../core/transition';
export declare class ToggleClassComponent extends Component {
    domClass: Record<string, boolean>;
    transition: boolean;
    _t: Map<string, [TransitionStates, EventListener]>;
    _i: number;
    constructor(attrs: ComponentAttributes);
    __render(): Node[];
    __beforeDestroy(): void;
    __update(first: boolean): void;
}
