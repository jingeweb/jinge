const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const csvStringify = require('csv-stringify/lib/sync');
const csvParse = require('csv-parse/lib/sync');
const _util = require('./util');
const {
  sharedOptions
} = require('./options');

/**
 * 所有 i18n 字典资源文件里渲染函数可能依赖的服务。
 */
const i18nRenderDeps = [
  'Component', '__', '$$', 'setText', 'ViewModelCoreImpl', 'attrs', 'vm', 'i18n', 'createElement', 'setAttribute',
  'createElementWithoutAttrs', 'createTextNode', 'I18nComponent', 'ParameterComponent', 'assertRenderResults',
  'textRenderFn', 'emptyRenderFn', 'i18nRenderFn', 'errorRenderFn', 'arrayEqual', 'createSVGElement', 'createSVGElementWithoutAttrs'
];
const i18nRenderDepsRegisterFile = path.resolve(__dirname, '../lib/__register_i18n_render_deps.js');

function _r(s, e) {
  return new Array(e - s + 1).fill(0).map((n, i) => String.fromCharCode(s + i));
}
function key2prop(key) {
  return /^[0-9]/.test(key) || /[^\d\w$_]/.test(key) ? JSON.stringify(key) : key;
}
function compare(a, b) {
  return a.location === b.location ? 0 : (a.location > b.location ? 1 : -1);
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
    this.idGenerators =  {
      dicts: new _util.KeyGenerator(),
      attrs: new _util.KeyGenerator(),
      renders: new _util.KeyGenerator()
    };
    this.renderDeps = null;
    this.keysOfResources = {
      dicts: new Map(),
      renders: new Map(),
      attrs: new Map()
    };
    // 标记 chunk 里面用到的所有 i18n keys
    this.chunkTags = null;
    this._inited = false;
    // 引用 webpack 的 warnings，用于向 webpack 输出告警。
    this.webpackCompilationWarnings = null;
    /**
     * 存储最终的 webpackChunkName 到生成的 css 文件名的映射。
     */
    this.outputChunks = new Map();
  }

  /**
   * initialize if need
   */
  initialize() {
    if (this._inited) return;
    this._inited = true;
    // 如果 jinge 框架是以 external 的形式引用，则所有依赖都已经在 jinge.min.js 中被注册。这种情况下，i18n 也默认注册好了所有依赖。
    const postfix = sharedOptions.symbolPostfix;
    this.renderDeps = {
      inner: Object.fromEntries(i18nRenderDeps.map(d => [d, -1])),
      arr: sharedOptions.i18n.external
        ? i18nRenderDeps.map(d => d + postfix)
        : [],
      map: sharedOptions.i18n.external 
        ? new Map(i18nRenderDeps.map((d, idx) => {
          return [d + postfix, idx];
        }))
        : new Map()
    };
    this.defaultLocale = {
      name: sharedOptions.i18n.defaultLocale,
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
    this.loadTargetCSV();
  }

  assertPluginInstalled() {
    if (this._inited) return;
    throw new Error('<_t> component or "_t:" attribute require JingeWebpackPlugin and i18n options');
  }

  _register(text, resourcePath, type, renderFnCb, multiChunkCallback) {
    if (text.startsWith('«')) {
      /*
       * '«' has special reference meaning, so we replace it with html encode
       */
      text = '&#xAB;' + text.slice(1);
    }
    const location = path.relative(sharedOptions.i18n.idBaseDir, resourcePath);

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
        if (!_util.isString(translateText) || !translateText) {
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
      regKey = this.idGenerators[type].generate(
        shouldMerge ? text : (text + location)
      );
      if (regKey.indexOf(':') >= 0) {
        this.webpackCompilationWarnings.push(new Error(`i18n key hash ${regKey} is conflict. \n${location}`));
      }
      info = {
        shouldMerge,
        firstOutput: null,
        entries: new Map()
      };
      info.entries.set(location, {
        key: regKey
      });
      meta.set(text, info);
      const output = {
        key: regKey,
        output: renderFnCb ? renderFnCb(this.defaultLocale.name, text) : text
      };
      outputTarget.push(output);
      info.firstOutput = output;
      pushNew = true;
    } else {
      if (info.entries.has(location)) {
        regKey = info.entries.get(location).key;
      } else if (!shouldMerge) {
        regKey = this.idGenerators[type].generate(
          text + location
        );
        if (regKey.indexOf(':') >= 0) {
          this.webpackCompilationWarnings.push(new Error(`i18n key hash ${regKey} is conflict. \n${location}`));
        }
        info.entries.set(location, {
          key: regKey
        });
        outputTarget.push({
          ref: info.firstOutput,
          key: regKey
          // output: JSON.stringify(`${type === 'dicts' ? '«' : ''}${info.firstOutput.key}`)
        });
        if (sharedOptions.chunk.multiple && multiChunkCallback) {
          multiChunkCallback(info.firstOutput.output);
        }
        pushNew = true;
      } else {
        if (sharedOptions.chunk.multiple && multiChunkCallback) {
          multiChunkCallback(info.firstOutput.output);
        }
        regKey = info.firstOutput.key;
      }
    }
    pushNew && this.targetLocales.forEach(targetLocale => {
      const targetOutputTarget = targetLocale.output[type];
      const targetInfo = targetLocale.meta[type].get(text);
      const entry = targetInfo?.entries.get(location);
      if (!entry || !entry.text) {
        targetOutputTarget.push({
          key: regKey,
          output: renderFnCb ? renderFnCb(targetLocale.name, text) : text
        });
        return;
      }
      const refEntry = getRefEntry(targetInfo.entries, entry, regKey, text);
      let output;
      if (!refEntry) {
        entry.firstOutput = output = {
          key: regKey,
          output: renderFnCb ? renderFnCb(targetLocale.name, entry.text) : entry.text
        };
      } else {
        if (!refEntry.firstOutput) throw new Error('unexpected!');
        entry.firstOutput = refEntry.firstOutput;
        output = {
          key: regKey,
          ref: entry.firstOutput
        };
        if (sharedOptions.chunk.multiple && multiChunkCallback) {
          multiChunkCallback(entry.firstOutput.output);
        }
      }
      targetOutputTarget.push(output);
    });

    /**
     * @param {Map} entries
     */
    function getRefEntry(entries, entry, srcKey, srcText) {
      entry.key = srcKey;
      const iter = entries.entries();
      let it = iter.next();
      while (!it.done) {
        const [k, v] = it.value;
        if (k !== location && v.key && v.text === entry.text) {
          return v;
        }
        it = iter.next();
      }
      return null;
    }

    if (!this.written && sharedOptions.chunk.multiple) {
      let keySet = this.keysOfResources[type].get(resourcePath);
      if (!keySet) {
        this.keysOfResources[type].set(resourcePath, keySet = new Set());
      }
      keySet.add(regKey);
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
  registerToRender(text, resourcePath, generateRenderFnCallback, multiChunkCallback) {
    return this._register(text, resourcePath, 'renders', generateRenderFnCallback, multiChunkCallback);
  }

  registerToAttr(text, resourcePath, wrapperFnCallback, multiChunkCallback) {
    return this._register(text, resourcePath, 'attrs', wrapperFnCallback, multiChunkCallback);
  }

  /**
   * @param {String} depId
   */
  registerRenderDep(depId) {
    let idx = -1;
    let first = false;
    if (!this.renderDeps.map.has(depId)) {
      first = true;
      idx = this.renderDeps.arr.length;
      this.renderDeps.arr.push(depId);
      this.renderDeps.map.set(depId, idx);
    } else {
      idx = this.renderDeps.map.get(depId);
    }

    const postfix = sharedOptions.symbolPostfix;
    if (!depId.endsWith(postfix)) {
      return (sharedOptions.chunk.multiple || first) ? idx : -1;
    }
    const dep = depId.substr(0, depId.length - postfix.length);
    if (!(dep in this.renderDeps.inner)) {
      throw new Error('unknown dep:' + dep);
    }
    this.renderDeps.inner[dep] = idx;
    return -1;
  }

  handleMultiChunk(compilation) {
    if (!this._inited || this.written) return;
    if (!sharedOptions.chunk.multiple) return;
    this.chunkTags = new Map();
    const chunkGraph = compilation.chunkGraph;
    compilation.chunks.forEach(chunk => {
      const tag = {
        dicts: new Map(), renders: new Map(), attrs: new Map()
      };
      const modules = chunkGraph.getChunkModules(chunk).filter(m => {
        return m.resource;
      });
      modules.forEach(mod => {
        ['dicts', 'renders', 'attrs'].forEach(type => {
          const keySet = this.keysOfResources[type].get(mod.resource);
          if (!keySet) return;
          keySet.forEach(k => {
            tag[type].set(k, true);
          });
        });
      });
      this.chunkTags.set(chunk, tag);
    })
  }
  handleDepRegisterModule(registerMod) {
    const cnt = registerMod._source._value;
    const inner = this.renderDeps.inner;
    registerMod._source._value = cnt.replace(/\/\*\*\/i18n\.__regDep\(0     , ([\w\d$_]+)\);/g, (m0, m1) => {
      const idx = inner[m1];
      // 以下逻辑保证替换后的代码完全不影响 sourcemap
      const idxStr = idx >= 0 ? (idx.toString()).padEnd(6, ' ') : '0     ';
      return `${idx >= 0 ? '/**/' : '////'}i18n.__regDep(${idxStr}, ${m1});`;
    });
  }
  writeOutput(compilation) {
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

    this.writeTranslateCSV(this.defaultLocale);
    this.targetLocales.forEach(locale => this.writeTranslateCSV(locale))
    
    const { assets, additionalChunkAssets, chunkGraph } = compilation;
    const entryChunks = Array.from(compilation.chunks).filter(chunk => {
      return chunkGraph.getNumberOfEntryModules(chunk) > 0;
    });
    if (entryChunks.length === 0) {
      throw new Error('Entry chunk not found!');
    }
    if (entryChunks.length > 1) {
      throw new Error('This version do not support multiply entries.');
    }
    const compilationChunks = Array.from(compilation.chunks);

    if (!sharedOptions.chunk.multiple) {
      if (compilationChunks.length > 1) {
        throw new Error('must set chunk.multiple = true if use webpack code splitting multi-chunk');
      }
      const filename = Array.from(entryChunks[0].files).find(f => f.endsWith('.js'));
      this.writeGenerateLocales(this.defaultLocale.name, {
        isEntry: true, isEmpty: false,
        filename: filename,
        finalFilename: ''
      }, this.defaultLocale.output, assets, additionalChunkAssets);
      this.targetLocales.forEach(locale => this.writeGenerateLocales(locale.name, {
        isEntry: true, isEmpty: false,
        filename: filename,
        finalFilename: ''
      }, locale.output, assets, additionalChunkAssets));
      this.defaultLocale = null;
      this.targetLocales = null;
      this.keysOfResources = null;
      return;
    }

    const idx = compilationChunks.indexOf(entryChunks[0]);
    if (idx < 0) throw new Error('unexpected. need handle it.');
    // 把 entry 所在的 chunk 移到最前面。
    if (idx !== 0) {
      compilationChunks.unshift(compilationChunks.splice(idx, 1)[0]);
    }
    const filenames = compilationChunks.map(chunk => {
      const f = Array.from(chunk.files).find(f => f.endsWith('.js'));
      if (!f) {
        throw new Error('output filename must be ends with ".js"');
      }
      return f;
    });

    const _write = (localeData) => {
      const chunkInfoMap = new Map();
      let entryChunkInfo;
      let entryOutputResult;
      compilationChunks.forEach((chunk, chunkIdx) => {
        const outputResult = {
          dicts: [], renders: [], attrs: []
        };
        const refMap = {
          dicts: new Map(), renders: new Map(), attrs: new Map()
        };
        const tagMap = this.chunkTags.get(chunk);
        let isEmpty = true;
        ['dicts', 'renders', 'attrs'].forEach(type => {
          localeData.output[type].forEach((it, i) => {
            if (!it) return;
            if (!tagMap[type].has(it.key)) return;
            if (chunkIdx === 0) {
              // 如果 key 属于 entry chunk，则在其它 chunk 中不需要重复出现。
              localeData.output[type][i] = null;
            }
            const refm = refMap[type];
            if (it.ref) {
              if (refm.has(it.ref.key)) {
                it = {
                  key: it.key,
                  ref: { key: refm.get(it.ref.key) }
                };
              } else {
                refm.set(it.ref.key, it.key);
                it = { key: it.key, output: it.ref.output };
              }
            } else {
              refm.set(it.key, it.key);
            }
            outputResult[type].push(it);
            isEmpty = false;
          });
        });

        const chunkInfo = {
          name: chunk.name || chunk.id.toString(),
          isEntry: chunkIdx === 0,
          isEmpty: isEmpty,
          isCommon: _util.isCommonChunk(chunk),
          filename: filenames[chunkIdx],
          finalFilename: '',
          deps: []
        };
        if (!chunkInfo.isCommon) {
          // 非公共 chunk 才需要输出到依赖字典。
          chunk._groups.forEach(chunkGroup => {
            chunkGroup.chunks.forEach(depChunk => {
              if (depChunk === chunk) return;
              chunkInfo.deps.push(depChunk.name || depChunk.id.toString());
            });
          });
        }
        if (chunkInfoMap.has(chunkInfo.name)) throw new Error('unexpected');
        chunkInfoMap.set(chunkInfo.name, chunkInfo);
        if (chunkIdx === 0) {
          if (chunkInfo.isCommon) throw new Error('unexpected');
          entryChunkInfo = chunkInfo;
          entryOutputResult = outputResult;
        } else {
          this.writeGenerateLocales(localeData.name, chunkInfo, outputResult, assets, additionalChunkAssets);
        }
      });
      this.writeGenerateLocales(localeData.name, entryChunkInfo, entryOutputResult, assets, additionalChunkAssets);
      this.outputChunks.set(localeData.name, chunkInfoMap);
    }

    _write(this.defaultLocale);
    this.targetLocales.forEach(locale => {
      return _write(locale);
    });
    this.defaultLocale = null;
    this.targetLocales = null;
    this.keysOfResources = null;
    this.chunkInfos = null;
    this.webpackCompilationWarnings = null;
  }

  writeGenerateLocales(localeName, chunkInfo, output, assets, additionalChunkAssets, subChunkInfoMap) {
    if (chunkInfo.isEmpty) {
      return;
    }
    const hasRender = output.renders.length > 0 || output.attrs.length > 0;
    const dictCode = output.dicts.map(r => `    ${key2prop(r.key)}: ${JSON.stringify(r.ref ? '«' + r.ref.key : r.output)}`).join(',\n');
    if (!hasRender && !dictCode) {
      chunkInfo.isEmpty = true;
      return;
    }

    const code = `(function() {${hasRender ? `
function renderFactory(
  ${this.renderDeps.arr.join(', ')}
) { return {
components: {
${output.renders.map(r => `  ${key2prop(r.key)}: ${r.ref ? JSON.stringify(r.ref.key) : r.output}`).join(',\n')}
},
attributes: {
${output.attrs.map(r => `  ${key2prop(r.key)}: ${r.ref ? JSON.stringify(r.ref.key) : r.output}`).join(',\n')}
}
}}` : ''}
const i18nData = {
  locale: "${localeName}"${dictCode ? `,
  dictionary: {
${dictCode}
  }`: ''}${hasRender ? `,
  render: renderFactory` : ''}
};
if (typeof jinge !== 'undefined') {
  jinge.i18n.__regLoc(i18nData);
} else {
  window.JINGE_I18N_DATA = i18nData;
}
})();`;
    const filename = chunkInfo.filename.replace(/(\.min)?\.js$/, m => '.' + localeName + m).replace(/[a-z0-9]{20}/, m => {
      return crypto.createHash('sha256').update(code).digest('hex').substr(0, 20);
    });
    if (additionalChunkAssets.indexOf(filename) < 0) {
      additionalChunkAssets.push(filename);
    }
    chunkInfo.finalFilename = filename;
    assets[filename] = {
      source: () => code,
      // 多语言资源字典没有 sourcemap 的说法。
      map: () => null
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
    const records = locale.nonTranslatedCsv.sort(compare).concat(locale.translatedCsv.sort(compare));
    const content = csvStringify(records, {
      columns
    });
    await fs.promises.writeFile(
      path.join(sharedOptions.i18n.translateDir, `translate.${locale.name}.csv`),
      `location,${dn}${locale.name === dn ? '' : `,${locale.name}`}` + '\n' + content
    );
  }

  loadTargetCSV() {
    fs.readdirSync(sharedOptions.i18n.translateDir).forEach(file => {
      const m = file.match(/^translate\.([\w_-]+)\.csv$/);
      if (!m) {
        console.error(`Warning: ${file} under translate directory will be ignored as file name not match format "translate.{LOCALE}.csv"`);
        return;
      }
      const locale = m[1].toLowerCase();
      if (locale !== sharedOptions.i18n.defaultLocale) {
        const targetMeta = {
          dicts: new Map(),
          renders: new Map(),
          attrs: new Map()
        };
        try {
          parseCsvContent(
            fs.readFileSync(path.join(sharedOptions.i18n.translateDir, file), 'utf-8'),
            sharedOptions.i18n.defaultLocale, locale, targetMeta.dicts
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

module.exports = {
  i18nManager: new I18nManager(),
  i18nRenderDeps, i18nRenderDepsRegisterFile
};
