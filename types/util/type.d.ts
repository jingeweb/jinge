export declare function typeOf(v: unknown): string;
export declare function isObject(v: unknown): boolean;
export declare function isString(v: unknown): boolean;
export declare function isNumber(v: unknown): boolean;
export declare function isUndefined(v: unknown): boolean;
export declare function isArray(v: unknown): boolean;
export declare function isBoolean(v: unknown): boolean;
export declare function isFunction(v: unknown): boolean;
export declare function isPromise(obj: {
    then?: unknown;
}): boolean;
