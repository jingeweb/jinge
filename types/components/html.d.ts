import { Component, ComponentAttributes } from '../core/component';
export declare class BindHtmlComponent extends Component {
    _c: string;
    constructor(attrs: ComponentAttributes);
    get content(): string;
    set content(v: string);
    __render(): Node[];
    __update(): void;
}
