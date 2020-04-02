import { Component, ComponentAttributes } from '../core/component';
import { TransitionStates } from '../core/transition';
export declare class IfComponent extends Component {
    _transitionMap: Map<string, [TransitionStates, Node]>;
    _previousValue: string;
    _currentValue: string;
    _onEndHandler: () => void;
    transition: string;
    constructor(attrs: ComponentAttributes);
    get expect(): boolean;
    set expect(value: boolean);
    get _branch(): boolean;
    onTransitionEnd(): void;
    __render(): Node[];
    __update(): void;
    __beforeDestroy(): void;
}
export declare class SwitchComponent extends Component {
    _transitionMap: Map<string, [TransitionStates, Node]>;
    _previousValue: string;
    _currentValue: string;
    _onEndHandler: () => void;
    transition: string;
    constructor(attrs: ComponentAttributes);
    get test(): string;
    set test(v: string);
    get _branch(): string;
    onTransitionEnd(): void;
    __render(): Node[];
    __update(): void;
    __beforeDestroy(): void;
}
