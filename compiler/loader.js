const { TemplateParser } = require('./template');
const { ComponentParser } = require('./parser');
const { CSSParser } = require('./style');
const store = require('./_store');
const path = require('path');
const jingeRoot = require('path').resolve(__dirname, '../');

const I18N_OPTION_NAMES = [
  'translateDir', 'defaultLocale', 'buildLocale'
];

function jingeLoader(source, sourceMap) {
  const callback = this.async();
  const resourcePath = this.resourcePath;
  const opts = this.query || {};
  const needCompress = ('compress' in opts) ? !!opts.compress : this._compiler.options.mode === 'production';
  // console.log(resourcePath);

  let parseOpts;
  let Parser;

  if (/\.(css|less|scss)$/.test(resourcePath)) {
    Parser = CSSParser;
    parseOpts = {
      resourcePath,
      componentStyleStore: store,
      compress: needCompress
    };
  } else {
    const iopt = opts.i18n || {mode: 'dictionary-reflect'};
    if (iopt.mode === 'compiler-translate') {
      I18N_OPTION_NAMES.forEach(n => {
        if (!iopt[n]) throw new Error(`jinge loader require non-empty option "i18n.${n}" when "i18n.mode" is "compiler-translate"`);
      });
      if (!iopt.idBaseDir) {
        iopt.idBaseDir = process.cwd();
      }
    } else if (iopt.mode !== 'dictionary-reflect') {
      throw new Error('jingeLoader option "i18n.mode" must be "dictionary-reflect" or "compiler-translate". see https://todo');
    }
    if (iopt.buildLocale !== iopt.defaultLocale) {
      store.i18n.loadTranslateCSV(iopt);
    }
    if (!('checkConflict' in iopt)) {
      iopt.checkConflict = this._compiler.options.mode === 'production';
    }
    parseOpts = {
      resourcePath,
      componentStyleStore: store,
      jingeBase: resourcePath.startsWith(jingeRoot) ? path.relative(path.dirname(resourcePath), jingeRoot) : 'jinge',
      webpackLoaderContext: this,
      tabSize: opts.tabSize,
      componentAlias: opts.componentAlias,
      componentBase: opts.componentBase,
      i18n: iopt,
      compress: needCompress
      // isProduction: this._compiler.options.mode === 'production',
    };
    Parser = /\.htm(l?)$/.test(resourcePath) ? TemplateParser : ComponentParser;
  }
  Parser.parse(source, sourceMap, parseOpts).then(result => {
    // console.log(result.code);
    // if (resourcePath.endsWith('.html')) console.log(result.code);
    callback(null, result.code, result.map || null, result.ast ? {
      webpackAST: result.ast
    } : null);
  }, callback);
}

module.exports = jingeLoader;
