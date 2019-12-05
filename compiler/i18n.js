const fs = require('fs');
const path = require('path');
const terser = require('terser');
const csvStringify = require('csv-stringify/lib/sync');
const csvParse = require('csv-parse/lib/sync');
const _util = require('./util');
const store = require('./store');

function _r(s, e) {
  return new Array(e - s + 1).fill(0).map((n, i) => String.fromCharCode(s + i));
}

function _k(regKey) {
  return /^[\w$_][\w\d$_]*$/.test(regKey) ? regKey : `${JSON.stringify(regKey)}`;
}

const CHARS = [
  '0',
  ..._r(97, 122),
  ..._r(49, 57),
  ..._r(65, 90),
  ..._r(32, 47),
  ..._r(58, 64),
  ..._r(91, 96),
  ..._r(123, 126)
];
/**
 * Ascii 表上，32 - 126 都是可
 * @param {Number} n
 */
function num2key(n) {
  const chars = [];
  let m = n;
  while (m >= CHARS.length) {
    const k = m / CHARS.length | 0;
    const r = m - k * CHARS.length;
    chars.unshift(CHARS[r]);
    m = k;
  }
  chars.unshift(CHARS[m]);
  return chars.join('');
}

function parseCsvContent(content, defaultLocale, targetLocale, targetMeta) {
  csvParse(content, {
    columns: true
  }).forEach((row, i) => {
    if (!row || !(defaultLocale in row) || !(targetLocale in row)) {
      throw new Error(`Bad format for "translate.${targetLocale}.csv". Wrong line format at ${i}. see https://todo.`);
    }
    let translateInfo = targetMeta.get(row[defaultLocale]);
    if (!translateInfo) {
      translateInfo = {
        allSame: true, // 对于同一个中文文本，是否翻译的文本全部相同
        firstText: row[targetLocale],
        entries: new Map()
      };
      targetMeta.set(row[defaultLocale], translateInfo);
    } else {
      if (translateInfo.firstText !== row[targetLocale]) {
        translateInfo.allSame = false;
      }
    }
    if (translateInfo.entries.has(row.location)) {
      throw new Error(`dulplicate csv entry at both line ${translateInfo.entries.get(row.location).lineAt} and line ${i} in "translate.${targetLocale}.csv"`);
    }
    translateInfo.entries.set(row.location, {
      lineAt: i, // 在 csv 文件中的行号
      key: null, // 预留字段
      text: row[targetLocale] // 翻译后的文本
    });
  });
}

class I18nManager {
  constructor() {
    this.written = false;
    this.defaultLocale = null;
    this.targetLocales = null;
    this.autoIncrementKey = 1;
    this.options = null;
    this.renderDeps = {
      map: new Map(),
      arr: []
    };
    this._inited = false;
  }

  /**
   * initialize if need
   */
  initialize(options) {
    if (this._inited) return;
    this._inited = true;
    this.options = options;
    this.defaultLocale = {
      name: options.defaultLocale,
      translatedCsv: [],
      nonTranslatedCsv: [],
      csvMeta: new Map(),
      meta: {
        dicts: new Map(),
        renders: new Map(),
        attrs: new Map()
      },
      output: {
        dicts: [],
        renders: [],
        attrs: []
      }
    };
    this.targetLocales = [];
    this.loadTargetCSV(options);
  }

  assertPluginInstalled() {
    if (this._inited) return;
    throw new Error('<_t> component or "_t:" attribute require JingeWebpackPlugin and i18n options');
  }

  _register(text, resourcePath, type, renderFnCb) {
    if (text.startsWith('«')) {
      /*
       * '«' has special reference meaning, so we replace it with html encode
       */
      text = '&#xAB;' + text.slice(1);
    }
    const location = path.relative(this.options.idBaseDir, resourcePath);

    // insert csv row if needed
    const csvInfo = this.defaultLocale.csvMeta.get(text);
    if (!this.written && (!csvInfo || !csvInfo.has(location))) {
      if (!csvInfo) {
        const m = new Map();
        m.set(location, true);
        this.defaultLocale.csvMeta.set(text, m);
      } else {
        csvInfo.set(location, true);
      }
      this.defaultLocale.nonTranslatedCsv.push({
        location,
        src: text
      });
      this.targetLocales.forEach(targetLocale => {
        const targetInfo = targetLocale.meta.dicts.get(text);
        let translateText = null;
        if (targetInfo && targetInfo.entries.has(location)) {
          translateText = targetInfo.entries.get(location).text;
        }
        const csvRow = {
          location,
          src: text,
          text: translateText
        };
        if (!_util.isString(translateText)) {
          targetLocale.nonTranslatedCsv.push(csvRow);
        } else {
          targetLocale.translatedCsv.push(csvRow);
        }
      });
    }

    // register locale resource
    const meta = this.defaultLocale.meta[type];
    let info = meta.get(text);
    /*
     * 对于某个待翻译的中文文本，如果已经翻译的 csv 资源中，所有该原始文本对应的翻译文本都是一样，
     *  比如，假设待翻译的是“很好”，在 en.csv 中全部是 "good"，那么就可以合并。
     *
     * 如果已经判断过（info !== null）或者已经输出过(this.written === true)，则不需要再判断。
     */
    const shouldMerge = info ? info.shouldMerge : (this.written || !this.targetLocales.some(targetLocale => {
      const targetInfo = targetLocale.meta[type].get(text);
      return targetInfo && !targetInfo.allSame;
    }));

    const outputTarget = this.defaultLocale.output[type];
    let pushNew = false;
    let regKey;
    if (!info) {
      regKey = num2key(outputTarget.length + 1);
      info = {
        shouldMerge,
        firstKey: regKey,
        entries: new Map()
      };
      info.entries.set(location, {
        key: regKey
      });
      meta.set(text, info);
      outputTarget.push({
        key: _k(regKey),
        output: renderFnCb ? renderFnCb(this.defaultLocale.name, text) : JSON.stringify(text)
      });
      pushNew = true;
    } else {
      if (info.entries.has(location)) {
        regKey = info.entries.get(location).key;
      } else if (!shouldMerge) {
        regKey = num2key(outputTarget.length + 1);
        info.entries.set(location, {
          key: regKey
        });
        outputTarget.push({
          key: _k(regKey),
          output: `"${type === 'dicts' ? '«' : ''}${info.firstKey}"`
        });
        pushNew = true;
      } else {
        regKey = info.firstKey;
      }
    }
    pushNew && this.targetLocales.forEach(targetLocale => {
      const targetOutputTarget = targetLocale.output[type];
      const targetInfo = targetLocale.meta[type].get(text);
      let targetText = text;
      if (targetInfo && targetInfo.entries.has(location)) {
        targetText = getRef(targetInfo.entries, location, regKey, text);
      }
      targetOutputTarget.push({
        key: _k(regKey),
        output: renderFnCb && !targetText.startsWith('«') ? renderFnCb(targetLocale.name, targetText) : (
          renderFnCb ? `"${targetText.substring(1)}"` : JSON.stringify(targetText)
        )
      });
    });

    /**
     * @param {Map} entries
     */
    function getRef(entries, location, srcKey, srcText) {
      const entry = entries.get(location);
      entry.key = srcKey;
      if (!_util.isString(entry.text)) {
        return text;
      }
      const iter = entries.entries();
      let it = iter.next();
      while (!it.done) {
        const [k, v] = it.value;
        if (k !== location && v.key && v.text === entry.text) {
          entry.text = '«' + v.key;
          break;
        }
        it = iter.next();
      }
      return entry.text;
    }
    return regKey;
  }

  /**
   * add text to defalut locale dictionary, return dictionary key.
   */
  registerToDict(text, resourcePath) {
    return this._register(text, resourcePath, 'dicts');
  }

  /**
   * add code of render function to default locale render map, return render key.
   * @param {String} renderFnCode
   */
  registerToRender(text, resourcePath, generateRenderFnCallback) {
    return this._register(text, resourcePath, 'renders', generateRenderFnCallback);
  }

  registerToAttr(text, resourcePath, wrapperFnCallback) {
    return this._register(text, resourcePath, 'attrs', wrapperFnCallback);
  }

  /**
   * @param {String} depId
   */
  registerRenderDep(depId) {
    const {
      map,
      arr
    } = this.renderDeps;
    if (map.has(depId)) {
      return -1;
    } else {
      arr.push(depId);
      map.set(depId, true);
      return arr.length - 1;
    }
  }

  async writeOutput(assets) {
    /*
     * Only write generated csv of default language at first emit time.
     * When use development mode, files will change and emit will be trigger many times,
     *   i18n text will change and have new translate id, but we can't detect old translate
     *   id at the same location. So we can't just update old translate id to new translate id.
     *
     * 在 watch 研发模式下，当代码发生变更后，代码里的待翻译的多语言文本的 translate id 可能发生变化，
     *   但无法将新的 id 和旧的 id 完全对应起来（没有找到完善的方案），因此也就无法实现在文件变化时及时
     *   更新默认语言的 csv 和 locale 文件。
     * 也不能采取简单地重新覆盖策略，因为存储待翻译文本的字典必须是全局的，但代码的变更是增量式的，
     *   新的 translate id 注册进来后，由于无法找到对应的旧的 id，也就无法删除残留的旧的 id。
     *
     * 事实上，研发模式下也不需要频繁切换多语言，往往是在默认语言下将模块开发完成，
     *   然后更新其它语言包，再重新运行和测试其它语言。
     */
    if (!this._inited || this.written) return;
    this.written = true;
    await Promise.all([
      this.writeTranslateCSV(this.defaultLocale),
      ...this.targetLocales.map(locale => this.writeTranslateCSV(locale)),
      this.writeGenerateLocales(this.defaultLocale, assets),
      ...this.targetLocales.map(locale => this.writeGenerateLocales(locale, assets))
    ]);
  }

  async writeGenerateLocales(locale, assets) {
    let code = `(function() {
function renderFactory(
  ${this.renderDeps.arr.join(', ')}
) { return {
components: {
${locale.output.renders.map(r => `  ${r.key}: ${r.output}`).join(',\n')}
},
attributes: {
${locale.output.attrs.map(r => `  ${r.key}: ${r.output}`).join(',\n')}
}
}}
const i18nData = {
  locale: "${locale.name}",
  dictionary: {
${locale.output.dicts.map(r => `    ${r.key}: ${r.output}`).join(',\n')}
  },
  render: renderFactory
};
if (typeof jinge !== 'undefined') {
  jinge.i18n.r(i18nData);
} else {
  window.JINGE_I18N_DATA = i18nData;
}
})();`;
    let filename = this.options.filename.replace('[locale]', locale.name);
    if (!filename.endsWith('.js')) {
      filename = filename + '.js';
    }
    if (store.options.compress) {
      code = terser.minify(code).code;
      filename = filename.replace(/\.js$/, '.min.js');
    }
    assets[filename] = {
      source: () => code,
      size: () => code.length
    };
  }

  async writeTranslateCSV(locale) {
    const dn = this.defaultLocale.name;
    const columns = [{
      key: 'location'
    }, {
      key: 'src'
    }];
    if (locale.name !== dn) {
      columns.push({
        key: 'text'
      });
    }
    const content = csvStringify(locale.nonTranslatedCsv.concat(locale.translatedCsv), {
      columns
    });
    await fs.promises.writeFile(
      path.join(this.options.translateDir, `translate.${locale.name}.csv`),
      `location,${dn}${locale.name === dn ? '' : `,${locale.name}`}` + '\n' + content
    );
  }

  loadTargetCSV(options) {
    fs.readdirSync(options.translateDir).forEach(file => {
      const m = file.match(/^translate\.([\w_-]+)\.csv$/);
      if (!m) {
        console.error(`Warning: ${file} under translate directory will be ignored as file name not match format "translate.{LOCALE}.csv"`);
        return;
      }
      const locale = m[1].toLowerCase();
      if (locale !== options.defaultLocale) {
        const targetMeta = {
          dicts: new Map(),
          renders: new Map(),
          attrs: new Map()
        };
        try {
          parseCsvContent(
            fs.readFileSync(path.join(options.translateDir, file), 'utf-8'),
            options.defaultLocale, locale, targetMeta.dicts
          );
          targetMeta.dicts.forEach((info, text) => {
            targetMeta.renders.set(text, _util.deepClone(info));
            targetMeta.attrs.set(text, _util.deepClone(info));
          });
          this.targetLocales.push({
            name: locale,
            meta: targetMeta,
            translatedCsv: [], // records which are translated
            nonTranslatedCsv: [], // records which are not translated
            output: {
              dicts: [],
              renders: [],
              attrs: []
            }
          });
        } catch (ex) {
          console.error(ex);
        }
      }
    });
  }
}

module.exports = new I18nManager();
