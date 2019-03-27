const { TemplateParser } = require('./template');
const { ComponentParser } = require('./parser');
const jingeRoot = require('path').resolve(__dirname, '../');

function jingeLoader(source) {
  const callback = this.async();
  const resourcePath = this.resourcePath;
  const Parser = /\.html$/.test(resourcePath) ? TemplateParser : ComponentParser;
  const opts = this.query || {};
  Parser.parse(source, {
    resourcePath,
    jingeBase: resourcePath.startsWith(jingeRoot) ? jingeRoot : 'jinge',
    webpackLoaderContext: this,
    tabSize: opts.tabSize,
    componentAlias: opts.componentAlias,
    componentBase: opts.componentBase,
    isProduction: this._compiler.options.mode === 'production'
  }).then(result => {
    callback(null, result.code, result.map || null, result.ast ? {
      webpackAST: result.ast
    } : null);
  }, callback);
}

module.exports = jingeLoader;
