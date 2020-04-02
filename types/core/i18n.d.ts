import { Messenger } from './messenger';
declare type FetchFn = (locale: string) => Promise<string>;
declare type StringOrFetchFn = string | FetchFn;
declare type RenderTextFn = (ctx?: Record<string, unknown>) => string;
declare type RenderFactory = (...deps: unknown[]) => RenderDicts;
declare type RenderFn = (...args: unknown[]) => Node[];
declare type RenderDict = {
    [k: string]: string | RenderFn;
};
declare type RenderDicts = {
    components: RenderDict;
    attributes: RenderDict;
};
declare type Locale = {
    locale: string;
    dictionary: {
        [k: string]: string | RenderTextFn;
    };
    render: RenderDicts | RenderFactory;
    __renders: RenderFactory[];
};
declare global {
    interface Window {
        JINGE_I18N_DATA: Locale;
    }
}
/**
 * convert i18n text template to function
 * @param {String} text i18n formatted text template
 */
export declare function compile(text: string): RenderTextFn;
export declare type WatchOptions = {
    /**
     * call watch listener immediatly. default is false.
     */
    immediate?: boolean;
    /**
     * unshift listener to start of queue. default is false.
     */
    prepend?: boolean;
};
/**
 * @interval
 */
export interface I18NChunkLoader {
}
declare class I18nService extends Messenger {
    __deps: unknown[];
    __data: Locale;
    __cache: Map<string, Locale>;
    __loader: I18NChunkLoader;
    __key: string;
    __activeChunks: string[];
    __loadedChunks: {
        [chunkName: string]: string[];
    }[];
    constructor();
    get locale(): string;
    /**
     * Register i18n render depedent.
     * This method will be called by compiler generated code, don't call it manully.
     */
    __regDep(idx: number, depent: unknown): void;
    /**
     * Register locale data, will be called in locale resource script.
     * Usually you don't need call this method manully.
     */
    __regLoc(data: Locale): void;
    /**
     * switch to another locale/language
     * @param locale 目标语言
     * @param filenameOrLoadFn 目标语言的资源包文件路径。如果为 chunk 服务指定了 meta 信息，则该参数可忽略，自动从 meta 信息里取。
     */
    switch(locale: string, filenameOrLoadFn?: StringOrFetchFn): Promise<void>;
    __t(key: string, params?: Record<string, unknown>): string;
    __r(key: string, type: keyof RenderDicts): RenderFn;
    /**
     * @param handler a listener bind to change event
     * @param immediate call listener immediately, default is false.
     * @returns a function auto remove listener
     */
    watch(listener: (locale: string) => void, immediate?: boolean): () => void;
    /**
     *
     * @param listener a listener bind to change event
     * @param options `immediate` call listener immediately, default is false. `prepend` unshift listener to make listener be called first.
     * @returns a function auto remove listener
     */
    watch(listener: (locale: string) => void, options?: WatchOptions): () => void;
}
export declare const i18n: I18nService;
/**
 * Compiler helper function, the first parameter will be convert to i18n dictionary key,
 * and the whole function will be transform to `i18nService._t(key, params)`
 *
 * But after i18n locale resource script had been written, compiler won't transform it,
 * the function will work as text parse util.
 *
 * @param {String|Object} text
 * @param {Object} params
 */
export declare function _t(text: string, params?: Record<string, unknown>): string;
export {};
