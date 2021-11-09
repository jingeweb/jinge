const { TemplateParser } = require('./template');
const { ComponentParser, componentBaseManager } = require('./component');
const { CSSParser, styleManager } = require('./style');
const { sharedOptions, getWebpackVersion } = require('./options');
const { checkCompressOption } = require('./plugin');
const { getSymbolPostfix } = require('./util');
const { aliasManager } = require('./template/alias');
const { i18nManager, i18nRenderDeps, i18nRenderDepsRegisterFile } = require('./i18n');

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
  if (!sharedOptions.style) {
    // 没有使用 plugin
    Object.assign(sharedOptions, {
      compress: checkCompressOption(webpackOpts),
      i18n: null,
      style: {
        attrPrefix: loaderOpts.attrPrefix,
        extract: false,
      },
    });
  } else if (!sharedOptions.style.attrPrefix) {
    sharedOptions.style.attrPrefix = loaderOpts.attrPrefix;
  }
  if (sharedOptions.i18n) {
    i18nManager.initialize();
  }
  styleManager.initialize();
  componentBaseManager.initialize(loaderOpts.componentBase);
  aliasManager.initialize(loaderOpts.componentAlias);
}

function jingeLoader(source, sourceMap) {
  const callback = this.async();
  if (this._compiler.parentCompilation) {
    return callback(null, source, sourceMap);
  }
  const resourcePath = this.resourcePath;
  const opts = this.query || {};

  if (!inited) {
    if (!/\.(ts|js)$/.test(resourcePath)) {
      return callback(new Error('Entry must be .js or .ts file'));
    }
    if (!('webpackVersion' in sharedOptions)) {
      sharedOptions.webpackVersion = getWebpackVersion(this._compiler);
    }
    initialize(opts, this._compiler.options);
    inited = true;
  }

  if (resourcePath === i18nRenderDepsRegisterFile) {
    if (sharedOptions.i18n) {
      // 此处自动生成的代码会引用全部可能的以来。接下来在 plugin 中会在 emit 前处理这个模块里的代码，只保留被用到过的依赖。
      return callback(
        null,
        `import {${i18nRenderDeps.join(',')}} from './__export';\n${i18nRenderDeps
          .map((d) => `/**/i18n.__regDep(0     , ${d});`)
          .join('\n')}`,
      );
    } else {
      // 如果没有启用多语言功能，不需要注册多语言资源文件里渲染函数的依赖，直接返回空代码。
      return callback(null, '');
    }
  }

  let parseOpts;
  let Parser;

  if (/\.(css|less|scss)$/.test(resourcePath)) {
    Parser = CSSParser;
    parseOpts = {
      resourcePath,
    };
  } else {
    if (!/\.(ts|js|html)$/.test(resourcePath)) {
      return callback(new Error('jingeLoader only support .ts,.js,.html,.css,.less,.scss file'));
    }

    parseOpts = {
      resourcePath,
      webpackLoaderContext: this,
    };
    Parser = /\.htm(l?)$/.test(resourcePath) ? TemplateParser : ComponentParser;
  }
  Parser.parse(source, sourceMap, parseOpts).then((result) => {
    callback(null, result.code, result.map || null);
  }, callback);
}

module.exports = jingeLoader;
