const {
  TemplateParser
} = require('./template');
const {
  ComponentParser,
  componentBaseManager
} = require('./component');
const {
  CSSParser
} = require('./style');
const {
  checkCompressOption
} = require('./plugin');

const store = require('./store');
const {
  aliasManager
} = require('./template/alias');

let componentBaseAndAliasInited = false;

function jingeLoader(source, sourceMap) {
  const callback = this.async();
  const resourcePath = this.resourcePath;
  const opts = this.query || {};

  if (!store.options) {
    store.options = {
      compress: checkCompressOption(this._compiler.options),
      i18n: null,
      style: {
        extract: false
      }
    };
  }

  let parseOpts;
  let Parser;

  if (/\.(css|less|scss)$/.test(resourcePath)) {
    Parser = CSSParser;
    parseOpts = {
      resourcePath
    };
  } else {
    if (!/\.(js|html)$/.test(resourcePath)) {
      return callback(new Error('jingeLoader only support .js,.html,.css,.less,.scss file'));
    }

    if (!componentBaseAndAliasInited) {
      componentBaseManager.initialize(opts.componentBase);
      aliasManager.initialize(opts.componentAlias);
      componentBaseAndAliasInited = true;
    }

    parseOpts = {
      resourcePath,
      webpackLoaderContext: this
    };
    Parser = /\.htm(l?)$/.test(resourcePath) ? TemplateParser : ComponentParser;
  }
  Parser.parse(source, sourceMap, parseOpts).then(result => {
    callback(null, result.code, result.map || null, result.ast ? {
      webpackAST: result.ast
    } : null);
  }, callback);
}

module.exports = jingeLoader;
