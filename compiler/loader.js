const { TemplateParser } = require('./template');
const { ComponentParser, componentBaseManager } = require('./component');
const { sharedOptions, getWebpackVersion } = require('./options');
const { checkCompressOption } = require('./plugin');
const { getSymbolPostfix } = require('./util');
const { aliasManager } = require('./template/alias');
const { i18nManager } = require('./i18n');

let inited = false;

function initialize(loaderOpts, webpackOpts) {
  if (loaderOpts.symbolPostfix) {
    if (sharedOptions.symbolPostfix && loaderOpts.symbolPostfix !== sharedOptions.symbolPostfix) {
      throw new Error('conflict symbolPostfix');
    }
    sharedOptions.symbolPostfix = loaderOpts.symbolPostfix;
  }
  if (!sharedOptions.symbolPostfix) {
    sharedOptions.symbolPostfix = getSymbolPostfix();
  }
  if ('compress' in sharedOptions) {
    Object.assign(sharedOptions, {
      compress: checkCompressOption(webpackOpts),
    });
  }
  if (sharedOptions.i18n) {
    i18nManager.initialize();
  }

  componentBaseManager.initialize(loaderOpts.componentBase);
  aliasManager.initialize(loaderOpts.componentAlias);
}

let warn = false;
function jingeLoader(source, sourceMap) {
  const callback = this.async();
  if (this._compiler.parentCompilation) {
    return callback(null, source, sourceMap);
  }
  const resourcePath = this.resourcePath;
  const opts = this.query || {};

  if (!inited) {
    if (!('webpackVersion' in sharedOptions)) {
      sharedOptions.webpackVersion = getWebpackVersion(this._compiler);
    }
    initialize(opts, this._compiler.options);
    inited = true;
  }

  if (!/\.(ts|js|html)$/.test(resourcePath)) {
    return callback(new Error('jingeLoader only support .ts,.js,.html file'));
  }
  if (!/\.c\.(ts|js|html)$/.test(resourcePath) && !warn) {
    warn = true;
    this.emitWarning(new Error('it is recommended to use `.c.(ts|js|html)` as component file suffix'));
  }
  const parseOpts = {
    resourcePath,
    webpackLoaderContext: this,
  };

  const Parser = resourcePath.endsWith('.html') ? TemplateParser : ComponentParser;
  Parser.parse(source, sourceMap, parseOpts).then((result) => {
    callback(null, result.code, result.map || null);
  }, callback);
}

module.exports = jingeLoader;
