/**
 * This plugin is used only for build jinge-framework itself,
 * do not use it anywhere else!
 */
const path = require('path');
const store = require('./_store');
const { ComponentParser } = require('./parser');

function jingeBuildSelfPlugin(opts) {
  return {
    name: 'jinge-build-self-plugin', // this name will show up in warnings and errors
    transform ( code, id ) {
      if (!id.startsWith(opts.innerComponentsDir)) return;
      if (path.basename(id) === 'index.js') return;
      return ComponentParser.parse(code, null, {
        resourcePath: id,
        componentStyleStore: store,
        jingeBase: path.relative(path.dirname(id), opts.jingeRoot),
        webpackLoaderContext: {
          context: '',
          resolve(ctx, source, callback) {
            const rf = path.resolve(opts.innerComponentsDir, source);
            return callback(
              null,
              rf.endsWith('.js') ? rf : (rf + '.js')
            );
          }
        },
        tabSize: opts.tabSize,
        componentAlias: opts.componentAlias,
        componentBase: opts.componentBase,
        compress: true
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
