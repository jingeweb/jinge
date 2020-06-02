/**
 * This plugin is used only for build pure javascript library.
 * Do not support style(css/scss/less...) files.
 * Use webpack to handle style files.
 * 
 * 注意！请不要用 rollup 来构建业务项目。rollup 只用于构建 library 项目，并且构建时 jinge 框架必须是 external 模式。
 */
const fs = require('fs');
const path = require('path');
const resolvePlugin = require('rollup-plugin-node-resolve');
const { sharedOptions } = require('./options');
const { ComponentParser } = require('./component');
const { aliasManager } = require('./template/alias');
const { getSymbolPostfix } = require('./util');
const { i18nRenderDeps, i18nRenderDepsRegisterFile } = require('./i18n');
const componentBaseManager = require('./component/base');

let componentBaseAndAliasInited = false;

function stat(file) {
  return new Promise(resolve => {
    fs.promises.stat(file).then(resolve, () => resolve(null));
  });
}

const rp = resolvePlugin({
  extensions: ['.js']
});

async function doResolve(ctx, source) {
  let rf = source;
  if (source.startsWith('.')) {
    rf = path.resolve(path.dirname(ctx), source);
  } else if (!source.startsWith('/')) {
    rf = (await rp.resolveId(source, ctx)).id;
  }
  const st = await stat(rf);
  if (st && st.isDirectory()) {
    return path.join(rf, 'index.js');
  }
  return rf.endsWith('.js') ? rf : rf + '.js';
}

function jingeRollupPlugin(opts) {
  const symbolPostfix = opts.symbolPostfix || getSymbolPostfix();
  sharedOptions.i18n = null;
  sharedOptions.style = { extract: false };
  sharedOptions.compress = opts.compress;
  sharedOptions.symbolPostfix = symbolPostfix;

  return {
    name: 'rollup-jinge-plugin',
    transform(code, id) {
      if (!id.endsWith('.js')) {
        throw new Error('rollup plugin only support .js file. try use webpack instead.')
      }
      if (id === i18nRenderDepsRegisterFile) {
        // 由于是构建 jinge library 的 dist bundle，所有的模块都会被打包。
        // 因此多语言的依赖也就直接按顺序注册全部依赖。
        return {
          code: `import {${i18nRenderDeps.join(',')}} from './__export';\n${i18nRenderDeps.map((d, i) => `/**/i18n.__regDep(${i.toString().padEnd(6, ' ')}, ${d});`).join('\n')}`
        };
      }
      if (!componentBaseAndAliasInited) {
        componentBaseManager.initialize(opts.componentBase);
        aliasManager.initialize(opts.componentAlias, symbolPostfix);
        componentBaseAndAliasInited = true;
      }
      return ComponentParser.parse(code, null, {
        resourcePath: id,
        symbolPostfix: symbolPostfix,
        webpackLoaderContext: {
          context: '',
          resolve(ctx, source, callback) {
            // if (source.startsWith('/')) debugger;
            // console.log(source)
            doResolve(id, source).then(file => {
              callback(null, file);
            }, callback);
          }
        }
      }).then(result => {
        // console.log(result.code);
        return result;
      });
    }
  };
}

module.exports = jingeRollupPlugin;
