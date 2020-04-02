export declare type ComponentStyle = {
    id: string;
    css: string;
};
declare class ComponentStyleManager {
    private m;
    /**
     * State
     * 0: not attached
     * 1: attached
     */
    private s;
    constructor();
    private create;
    add(sty: ComponentStyle): void;
    attch(): void;
    remove(sty: ComponentStyle): void;
}
export declare const manager: ComponentStyleManager;
export {};
