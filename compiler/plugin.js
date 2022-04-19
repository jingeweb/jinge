const path = require('path');
const _util = require('./util');
const { sharedOptions, checkCompressOption, getWebpackVersion } = require('./options');
const { i18nManager, i18nRenderDepsRegisterFile } = require('./i18n');

const PLUGIN_NAME = 'JINGE_EXTRACT_PLUGIN';

function isCommonChunk(chunk) {
  return sharedOptions.webpackVersion >= 5 ? _util.isCommonChunk_v5(chunk) : _util.isCommonChunk_v4(chunk);
}

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
      sharedOptions.i18n = Object.assign(
        {
          idBaseDir: process.cwd(),
          translateDir: path.join(process.cwd(), 'translate'),
        },
        i18nOptions,
      );
    }

    const chunkOptions = sharedOptions.chunk;
    if (!chunkOptions) {
      sharedOptions.chunk = {
        multiple: false,
        writeInfo: null,
        includeCommon: false,
      };
    } else {
      sharedOptions.chunk = Object.assign(
        {
          multiple: false,
          writeInfo: null,
          includeCommon: false,
        },
        chunkOptions,
      );
    }
  }

  apply(compiler) {
    if (!('webpackVersion' in sharedOptions)) {
      sharedOptions.webpackVersion = getWebpackVersion(compiler);
    }
    this._prepareOptions(compiler.options);

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      if (compilation.compiler.parentCompilation) {
        return;
      }
      i18nManager.webpackCompilationWarnings = compilation.warnings;
      if (sharedOptions.i18n) {
        compilation.hooks.optimizeModules.tap(PLUGIN_NAME, (modules) => {
          if (i18nManager.written) return;
          const registerMod = Array.from(modules).find((mod) => mod.resource === i18nRenderDepsRegisterFile);
          if (!registerMod) {
            // 如果没有找到 i18nRenderDepsRegisterFile 这个文件，说明 jinge 框架是以 external 的模式引入的（即没有编译源码）
            if (!sharedOptions.i18n.external) {
              compilation.errors.push(
                new Error(
                  'Please set JingeWebpackPlugin option "i18n.external" to `true` if use jinge as external library.',
                ),
              );
            }
          } else {
            i18nManager.handleDepRegisterModule(registerMod);
          }
        });
      }
      if (sharedOptions.chunk.multiple) {
        compilation.hooks.optimizeChunks.tap(PLUGIN_NAME, (chunks) => {
          chunks.forEach((chunk) => {
            const name = chunk.name;
            if (!name) {
              compilation.warnings.push(new Error('chunk miss webpackChunkName'));
            }
            if (sharedOptions.webpackVersion < 5) {
              // 对于 webpack 4，暂时没找到好的方法判断一个 chunk 是否是 webpack 自动提取出来的共用代码公共 chunk，
              // 只能依靠它的名称是否包含 ~ 字符判断（webpack 生成共用 chunk 的名称的规则是用 ~ 符号连接各 chunk 名称）
              // 因此要求 chunk 的名称里不能包含 ~ 字符。
              if (name && name.indexOf('~') >= 0) {
                compilation.errors.push(new Error('webpackChunkName must not include "~", but got: ' + name));
              }
            }
          });
        });
        compilation.hooks.afterOptimizeChunks.tap(PLUGIN_NAME, () => {
          // styleManager.handleMultiChunk(compilation);
          if (!i18nManager.written) {
            i18nManager.handleMultiChunk(compilation);
          }
        });
      }

      compilation.hooks.additionalAssets.tap(PLUGIN_NAME, () => {
        if (sharedOptions.i18n) {
          i18nManager.writeOutput(compilation);
        }
        // styleManager.writeOutput(compilation);
        if (sharedOptions.chunk.writeInfo) {
          this._writeChunkInfo(compilation);
        }
      });
    });
  }

  _writeChunkInfo(compilation) {
    const { webpackVersion } = sharedOptions;
    const info = {
      public: sharedOptions.publicPath,
      style: { entry: '', chunks: {} },
      script: { entry: '', chunks: {} },
      locale: {},
    };

    const chunkGraph = compilation.chunkGraph;
    compilation.chunks.forEach((chunk) => {
      if (webpackVersion >= 5) {
        const files = Array.from(chunk.files);
        const ems = Array.from(chunkGraph.getChunkEntryModulesIterable(chunk));
        if (
          ems.length > 1 &&
          ems.filter((em) => {
            return em.resource && em.resource.indexOf('/node_modules/') < 0;
          }).length > 1
        ) {
          compilation.warnings.push(new Error('UNEXPECTED: number of entry modules is greater than 1.'));
        }
        if (ems.length > 0) {
          info.script.entry = files.find((f) => f.endsWith('.js'));
        } else if (!isCommonChunk(chunk) || sharedOptions.chunk.includeCommon) {
          const name = chunk.name || chunk.id.toString();
          info.script.chunks[name] = files.find((f) => f.endsWith('.js'));
        }
      } else {
        if (chunk.entryModule) {
          info.script.entry = chunk.files.find((f) => f.endsWith('.js'));
        } else if (!isCommonChunk(chunk) || sharedOptions.chunk.includeCommon) {
          const name = chunk.name || chunk.id.toString();
          info.script.chunks[name] = chunk.files.find((f) => f.endsWith('.js'));
        }
      }
    });

    function handleChunkMap(chunksMap, out) {
      chunksMap.forEach((chunkInfo) => {
        if (chunkInfo.isEntry) {
          out.entry = chunkInfo.finalFilename;
          return;
        }
        if (chunkInfo.isCommon) {
          if (sharedOptions.chunk.includeCommon) {
            out.chunks[chunkInfo.name] = chunkInfo.isEmpty ? null : chunkInfo.finalFilename;
          }
          return;
        }
        const cns = chunkInfo.deps
          .map((cn) => {
            return chunksMap.get(cn);
          })
          .filter((ck) => {
            return ck && !ck.isEmpty;
          });
        if (!chunkInfo.isEmpty) {
          cns.push(chunkInfo);
        }
        out.chunks[chunkInfo.name] =
          cns.length === 0 ? null : cns.length === 1 ? cns[0].finalFilename : cns.map((ck) => ck.finalFilename);
      });
    }

    // handleChunkMap(styleManager.outputChunks, info.style);
    i18nManager.outputChunks.forEach((chunksMap, locale) => {
      if (!info.locale[locale]) info.locale[locale] = { entry: '', chunks: {} };
      handleChunkMap(chunksMap, info.locale[locale]);
    });

    const output = sharedOptions.compress ? JSON.stringify(info) : JSON.stringify(info, null, 2);
    compilation.assets[sharedOptions.chunk.writeInfo] =
      webpackVersion >= 5
        ? {
            source: () => output,
            map: () => null,
          }
        : {
            source: () => output,
            size: () => output.length,
          };
  }
}

module.exports = {
  checkCompressOption,
  JingeWebpackPlugin,
};
