import { Component, ComponentAttributes } from '../core/component';
export declare class I18nComponent extends Component {
    _key: string;
    _vms: unknown[];
    _sty: string;
    constructor(attrs: ComponentAttributes, renderKey: string, cstyId: string, renderVms: unknown[]);
    __render(): Node[];
    _onchange(): void;
    __update(): void;
    __beforeDestroy(): void;
}
