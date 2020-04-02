import { Component, ComponentAttributes } from '../core/component';
/**
 * This component is only for development purpose
 */
export declare class LogComponent extends Component {
    _msg: unknown;
    constructor(attrs: ComponentAttributes);
    set msg(v: unknown);
    get msg(): unknown;
    __render(): Node[];
}
