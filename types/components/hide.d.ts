import { ToggleClassComponent } from './class';
import { ComponentAttributes } from '../core/component';
export declare class HideComponent extends ToggleClassComponent {
    constructor(attrs: ComponentAttributes & {
        class: {
            'jg-hide': boolean;
        };
    });
}
