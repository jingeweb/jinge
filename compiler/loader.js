const { TemplateParser } = require('./template');
const { ComponentParser } = require('./parser');
const { CSSParser } = require('./style');
const store = require('./_store');
const jingeRoot = require('path').resolve(__dirname, '../');

function jingeLoader(source) {
  const callback = this.async();
  const resourcePath = this.resourcePath;
  const opts = this.query || {};
  // console.log(resourcePath);

  let parseOpts;
  let Parser;

  if (/\.(css|less|scss)$/.test(resourcePath)) {
    Parser = CSSParser;
    parseOpts = {
      resourcePath,
      componentStyleStore: store,
      isProduction: this._compiler.options.mode === 'production'
    };
  } else {
    parseOpts = {
      resourcePath,
      componentStyleStore: store,
      jingeBase: resourcePath.startsWith(jingeRoot) ? jingeRoot : 'jinge',
      webpackLoaderContext: this,
      tabSize: opts.tabSize,
      componentAlias: opts.componentAlias,
      componentBase: opts.componentBase,
      isProduction: this._compiler.options.mode === 'production'
    };
    Parser = /\.htm(l?)$/.test(resourcePath) ? TemplateParser : ComponentParser;
  }
  Parser.parse(source, parseOpts).then(result => {
    // if (resourcePath.endsWith('.html')) console.log(result.code);
    callback(null, result.code, result.map || null, result.ast ? {
      webpackAST: result.ast
    } : null);
  }, callback);
}

module.exports = jingeLoader;
