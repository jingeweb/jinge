import { Component, ComponentAttributes } from '../core/component';
import { ViewModelArray, ViewModelObject } from '../vm/common';
declare type ForKeyNameFn = (v: unknown) => string;
declare type ForKeyName = string | ForKeyNameFn;
export declare class ForEachComponent extends Component {
    _e: ViewModelObject;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    constructor(attrs: ComponentAttributes, item: unknown, index: number, isLast: boolean);
    get each(): ViewModelObject;
    set each(v: ViewModelObject);
    __render(): Node[];
}
export declare class ForComponent extends Component {
    _l: ViewModelArray;
    _keyName: ForKeyName;
    _length: number;
    _keys: unknown[];
    _waitingUpdate: boolean;
    constructor(attrs: ComponentAttributes);
    get loop(): ViewModelArray;
    set loop(v: ViewModelArray);
    __render(): Node[];
    _updateItem(index: number): void;
    __update(): void;
}
export {};
