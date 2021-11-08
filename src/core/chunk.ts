import { isArray, createElement } from '../util';
import { i18n, I18NChunkLoader } from './i18n';

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

const fileCache = new Map();

function loadLink(href: string): Promise<unknown> {
  return new Promise<void>((resolve, reject) => {
    if (fileCache.has(href)) {
      return resolve();
    }
    const $s = createElement('link', {
      rel: 'stylesheet',
      href: href,
    }) as HTMLLinkElement;
    $s.onload = (): void => {
      fileCache.set(href, true);
      resolve();
    };
    $s.onerror = reject;
    document.head.appendChild($s);
  });
}

function loadLocale(url: string): Promise<unknown> {
  return fileCache.has(url)
    ? Promise.resolve()
    : fetch(url)
        .then((res) => res.text())
        .then((code) => {
          fileCache.set(url, true);
          new Function('jinge', code)({
            i18n,
          });
        });
}

function load(
  fn: (url: string) => Promise<unknown>,
  file: string | string[],
  chunkName: string,
  loadedSet: Set<string>,
  baseHref: string,
): Promise<unknown> {
  if (!file) {
    loadedSet.add(chunkName);
    return Promise.resolve();
  }
  if (isArray(file)) {
    return Promise.all((file as string[]).map((lf) => fn(baseHref + lf))).then(() => {
      loadedSet.add(chunkName);
    });
  } else {
    return fn(baseHref + (file as string)).then(() => {
      loadedSet.add(chunkName);
    });
  }
}

export class ChunkResourceLoader implements I18NChunkLoader {
  /**
   * active chunks;
   */
  private _acs: Set<string>;
  /**
   * loaded chunks;
   */
  private _lcs: {
    style: Set<string>;
    locale: {
      [locale: string]: Set<string>;
    };
  };
  /**
   * resource meta info
   */
  meta: ResourceMeta;

  constructor() {
    this.meta = null;
    this._acs = new Set();
    this._lcs = { style: new Set(), locale: {} };
  }

  /**
   * @interval
   * get locale entry file url
   */
  _get(locale: string): string {
    if (!this.meta) return null;
    return this.meta.public + this.meta.locale[locale].entry;
  }

  /**
   * @internal
   */
  async _load(locale?: string): Promise<void> {
    if (this._acs.size === 0) return;
    if (!locale) locale = i18n.locale;
    const meta = this.meta;
    if (!meta) throw new Error('meta required.');
    const promises: Promise<unknown>[] = [];
    const baseHref = meta.public;
    const lsty = this._lcs.style;
    let lloc = this._lcs.locale[locale];
    if (!lloc) {
      this._lcs.locale[locale] = lloc = new Set();
    }
    this._acs.forEach((chunkName) => {
      if (!lsty.has(chunkName)) {
        promises.push(load(loadLink, meta.style.chunks[chunkName], chunkName, lsty, baseHref));
      }
      if (!lloc.has(chunkName)) {
        promises.push(load(loadLocale, meta.locale[locale].chunks[chunkName], chunkName, lloc, baseHref));
      }
    });
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  active(chunkName: string): Promise<void> {
    this._acs.add(chunkName);
    return this._load();
  }

  deactive(chunkName: string): void {
    this._acs.delete(chunkName);
  }
}

// singleton
export const chunk = new ChunkResourceLoader();
i18n.__loader = chunk;
