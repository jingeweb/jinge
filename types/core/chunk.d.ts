import { I18NChunkLoader } from './i18n';
interface Resource {
    entry: string;
    chunks: {
        [chunkName: string]: string | string[];
    };
}
export interface ResourceMeta {
    public: string;
    style: Resource;
    script: Resource;
    locale: {
        [locale: string]: Resource;
    };
}
export declare class ChunkResourceLoader implements I18NChunkLoader {
    /**
     * active chunks;
     */
    private _acs;
    /**
     * loaded chunks;
     */
    private _lcs;
    /**
     * resource meta info
     */
    meta: ResourceMeta;
    constructor();
    /**
     * @interval
     * get locale entry file url
     */
    _get(locale: string): string;
    active(chunkName: string): Promise<void>;
    deactive(chunkName: string): void;
}
export declare const chunk: ChunkResourceLoader;
export {};
