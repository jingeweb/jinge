/**
 * This plugin is used only for build jinge-framework itself,
 * do not use it anywhere else!
 */
const fs = require('fs');
const path = require('path');
const store = require('../compiler/store');
const {
  ComponentParser
} = require('../compiler/component');
const {
  aliasManager
} = require('../compiler/template/alias');
const componentBaseManager = require('../compiler/component/base');

let componentBaseAndAliasInited = false;

function stat(file) {
  return new Promise(resolve => {
    fs.promises.stat(file).then(resolve, () => resolve(null));
  });
}

async function doResolve(innerComponentsDir, source) {
  const rf = path.resolve(innerComponentsDir, source);
  const st = await stat(rf);
  if (st && st.isDirectory()) {
    return path.join(rf, 'index.js');
  }
  return rf.endsWith('.js') ? rf : rf + '.js';
}

function jingeBuildSelfPlugin(opts) {
  return {
    name: 'jinge-build-self-plugin', // this name will show up in warnings and errors
    transform(code, id) {
      if (!store.options) {
        store.options = {
          compress: opts.compress,
          i18n: null,
          style: {
            extract: false
          }
        };
      }
      if (!componentBaseAndAliasInited) {
        componentBaseManager.initialize(opts.componentBase);
        aliasManager.initialize(opts.componentAlias);
        componentBaseAndAliasInited = true;
      }
      return ComponentParser.parse(code, null, {
        resourcePath: id,
        jingeBase: path.relative(path.dirname(id), opts.jingeRoot),
        webpackLoaderContext: {
          context: '',
          resolve(ctx, source, callback) {
            doResolve(opts.innerComponentsDir, source).then(file => {
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

module.exports = {
  jingeBuildSelfPlugin
};
