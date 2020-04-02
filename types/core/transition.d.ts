export declare enum TransitionStates {
    ENTERING = 1,
    ENTERED = 2,
    LEAVING = 3,
    LEAVED = 4
}
export declare type DurationType = 'transitionend' | 'animationend';
export declare type Duration = {
    type: DurationType;
    time: number;
};
export declare function getDurationType(el: Element): DurationType;
export declare function getDuration(el: Element): Duration;
