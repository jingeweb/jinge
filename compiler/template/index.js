const {
  replaceTplStr
} = require('../util');
const {
  sharedOptions
} = require('../options');
const {
  styleManager
} = require('../style');
const {
  parse
} = require('./helper');
const {
  aliasManager
} = require('./alias');
const {
  TemplateVisitor
} = require('./TemplateVisitor');

const TPL = require('./tpl');

class JingeTemplateParser {
  static _parse(content, options) {
    function cl(s) {
      return s ? '\n' + s : '';
    }
    const tplParser = new JingeTemplateParser(options);
    const result = tplParser.parse(content);
    const depRegex = new RegExp(`([\\w$_][\\w\\d$_]+)${sharedOptions.symbolPostfix}\\b`, 'g');
    const imports = [
      ...new Set([
        ...result.renderFn.matchAll(depRegex),
        ...(result.i18nDeps ? result.i18nDeps.matchAll(depRegex) : [])
      ].map(m => m[1]))
    ].map(d => `${d} as ${d}${sharedOptions.symbolPostfix}`);
    return options.wrapCode !== false ? {
      code: `import {  ${imports.join(', ')} } from 'jinge';` +
        cl(result.aliasImports) + cl(result.imports) + cl(result.i18nDeps) +
        `\nexport default ${result.renderFn}`
    } : {
      globalImports: imports,
      i18nDeps: result.i18nDeps,
      aliasImports: result.aliasImports,
      localImports: result.imports,
      renderFn: result.renderFn
    };
  }

  static async parse(content, sourceMap, options) {
    return new Promise((resolve, reject) => {
      try {
        resolve(JingeTemplateParser._parse(content, options));
      } catch (err) {
        reject(err);
      }
    });
  }

  constructor(options) {
    this.resourcePath = options.resourcePath;
    this.baseLinePosition = options.baseLinePosition || 1;
    const info = styleManager.templates.get(this.resourcePath);
    this.componentStyleId = options.componentStyleId || (
      info ? info.styleId : null
    );
    this.webpackLoaderContext = options.webpackLoaderContext;
  }

  parse(source) {
    if (!source.trim()) {
      return {
        aliasImports: '',
        imports: '',
        renderFn: replaceTplStr(TPL.EMPTY, {
          POSTFIX: sharedOptions.symbolPostfix
        })
      };
    }
    const [meetErr, tree] = parse(source);
    if (meetErr) {
      this._logParseError(source, meetErr, 'syntax of template is error.');
      return {
        aliasImports: '',
        imports: '',
        renderFn: replaceTplStr(TPL.ERROR, {
          POSTFIX: sharedOptions.symbolPostfix
        })
      };
    }
    const visitor = new TemplateVisitor({
      source: source,
      webpackLoaderContext: this.webpackLoaderContext,
      baseLinePosition: this.baseLinePosition,
      resourcePath: this.resourcePath,
      componentStyleId: this.componentStyleId
    });
    try {
      return visitor.visit(tree);
    } catch (ex) {
      this.webpackLoaderContext.emitError(ex);
      return {
        aliasImports: '',
        imports: '',
        renderFn: replaceTplStr(TPL.ERROR, {
          POSTFIX: sharedOptions.symbolPostfix
        })
      };
    }
  }

  _logParseError(source, tokenPosition, msg) {
    let idx = -1;
    for (let i = 0; i < tokenPosition.line - 1; i++) {
      idx = source.indexOf('\n', idx + 1);
    }
    idx = idx + 1;
    const eidx = source.indexOf('\n', idx);
    this.webpackLoaderContext.emitError(new Error(`Error occur at line ${tokenPosition.line + this.baseLinePosition - 1}, column ${tokenPosition.column}:
> ${source.substring(idx, eidx > idx ? eidx : source.length)}
> ${this.resourcePath}
> ${msg}`));
  }
}

module.exports = {
  TemplateParser: JingeTemplateParser,
  aliasManager: aliasManager
};
