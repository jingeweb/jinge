const path = require('path');
const {
  sharedOptions,
  checkCompressOption
} = require('./options');
const {
  styleManager
} = require('./style');
const {
  i18nManager, i18nRenderDepsRegisterFile
} = require('./i18n');

const PLUGIN_NAME = 'JINGE_EXTRACT_PLUGIN';

class JingeWebpackPlugin {
  constructor(options = {}) {
    Object.assign(sharedOptions, options);
    this.vmPlugin = null;
    this._inited = false;
  }

  _prepareOptions(webpackOptions) {
    sharedOptions.compress = checkCompressOption(webpackOptions);
    sharedOptions.publicPath = webpackOptions.output.publicPath || '';
    const i18nOptions = sharedOptions.i18n;
    if (i18nOptions) {
      if (!i18nOptions.defaultLocale) {
        throw new Error('JingeWebpackPlugin: i18n options require "defaultLocale" property.');
      }
      sharedOptions.i18n = Object.assign({
        idBaseDir: process.cwd(),
        translateDir: path.join(process.cwd(), 'translate')
      }, i18nOptions);
    }

    const styleOptions = sharedOptions.style;
    if (!styleOptions) {
      sharedOptions.style = {
        extract: false
      };
    } else {
      sharedOptions.style = Object.assign({}, {
        extract: true,
        keepComments: false
      }, styleOptions);
    }
  }

  apply(compiler) {
    this._prepareOptions(compiler.options);

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      i18nManager.webpackCompilationWarnings = compilation.warnings;
      if (sharedOptions.i18n) {
        compilation.hooks.optimizeModules.tap(PLUGIN_NAME, modules => {
          if (i18nManager.written) return;
          const registerMod = modules.find(mod => mod.resource === i18nRenderDepsRegisterFile);
          if (!registerMod) {
            // 如果没有找到 i18nRenderDepsRegisterFile 这个文件，说明 jinge 框架是以 external 的模式引入的（即没有编译源码）
            if (!sharedOptions.i18n.external) {
              compilation.errors.push(new Error('Please set JingeWebpackPlugin option "i18n.external" to `true` if use jinge as external library.'));
            }
          } else {
            i18nManager.handleDepRegisterModule(registerMod);
          }
        });
      }
      if (sharedOptions.multiChunk) {
        compilation.hooks.optimizeChunks.tap(PLUGIN_NAME, (chunks) => {
          chunks.forEach(chunk => {
            const name = chunk.name || chunk.id.toString();
            if (name && !/^\w[\w\d_]*$/.test(name)) {
              compilation.errors.push(new Error('webpackChunkName "' + name + '" not match /^\\w[\\w\\d_]*$/'));
            }
          });
        });
        compilation.hooks.afterOptimizeChunks.tap(PLUGIN_NAME, (chunks) => {
          styleManager.handleMultiChunk(compilation);
          if (!i18nManager.written) {
            i18nManager.handleMultiChunk(compilation);
          }
        });
      }
      
      compilation.hooks.additionalAssets.tap(PLUGIN_NAME, (chunks) => {
        if (sharedOptions.i18n) {
          i18nManager.writeOutput(compilation);
        }
        styleManager.writeOutput(compilation);
        if (sharedOptions.writeChunkInfo) {
          this._writeChunkInfo(compilation);
        }
      });
    });
  }

  _writeChunkInfo(compilation) {
    const info = {
      public: sharedOptions.publicPath,
      style: { entry: '', chunks: {} },
      script: { entry: '', chunks: {} },
      locale: {}
    };

    compilation.chunks.forEach(chunk => {
      if (chunk.entryModule) {
        info.script.entry = chunk.files.find(f => f.endsWith('.js'));
      } else {
        const name = chunk.name || chunk.id.toString();
        info.script.chunks[name] = chunk.files.find(f => f.endsWith('.js'));
      }
    });

    function handleChunkMap(chunksMap, out) {
      chunksMap.forEach(chunkInfo => {
        if (chunkInfo.isEntry) {
          out.entry = chunkInfo.finalFilename;
          return;
        }
        if (chunkInfo.isCommon) {
          out.chunks[chunkInfo.name] = chunkInfo.isEmpty ? null : chunkInfo.finalFilename;
          return;
        }
        const cns = chunkInfo.deps.map(cn => {
          return chunksMap.get(cn);
        }).filter(ck => {
          return ck && !ck.isEmpty;
        });
        if (!chunkInfo.isEmpty) {
          cns.push(chunkInfo);
        }
        out.chunks[chunkInfo.name] = cns.length === 0 ? null : (
          cns.length === 1 ? cns[0].finalFilename : cns.map(ck => ck.finalFilename)
        );
      });
    }

    handleChunkMap(styleManager.outputChunks, info.style);
    i18nManager.outputChunks.forEach((chunksMap, locale) => {
      if (!info.locale[locale]) info.locale[locale] = { entry: '', chunks: {} };
      handleChunkMap(chunksMap, info.locale[locale]);
    });

    const output = sharedOptions.compress ? JSON.stringify(info) : JSON.stringify(info, null, 2);
    compilation.assets[sharedOptions.writeChunkInfo] = {
      source: () => output,
      size: () => output.length
    };
  }
}

module.exports = {
  checkCompressOption,
  JingeWebpackPlugin
};
