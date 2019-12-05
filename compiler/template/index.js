const {
  replaceTplStr
} = require('../util');
const store = require('../store');
const {
  parse,
  CORE_UNIQUE_POSTFIX
} = require('./helper');
const {
  aliasManager,
  ALIAS_UNIQUE_POSTFIX
} = require('./alias');
const {
  TemplateVisitor
} = require('./TemplateVisitor');

const TPL = require('./tpl');

const CORE_DEP_REG = new RegExp(`(\\w[\\w\\d_]+)${CORE_UNIQUE_POSTFIX}\\b`, 'g');

class JingeTemplateParser {
  static _parse(content, options = {}) {
    function cl(s) {
      return s ? '\n' + s : '';
    }
    const tplParser = new JingeTemplateParser(options);
    const result = tplParser.parse(content);
    const imports = [
      ...new Set([
        ...result.renderFn.matchAll(CORE_DEP_REG),
        ...(result.i18nDeps ? result.i18nDeps.matchAll(CORE_DEP_REG) : [])
      ].map(m => m[1]))
    ].map(d => `${d} as ${d}${CORE_UNIQUE_POSTFIX}`);
    // if (result.i18nDeps) {
      // imports.add('i18n');
      // imports.add('I18N_REG_DEP');
    // }
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

  static async parse(content, sourceMap, options = {}) {
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
    const info = store.templates.get(this.resourcePath);
    this.componentStyleId = options.componentStyleId || (
      info ? info.styleId : null
    );
  }

  parse(source) {
    if (!source.trim()) {
      return {
        aliasImports: '',
        imports: '',
        renderFn: replaceTplStr(TPL.EMPTY, {
          POSTFIX: CORE_UNIQUE_POSTFIX
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
          POSTFIX: CORE_UNIQUE_POSTFIX
        })
      };
    }
    const visitor = new TemplateVisitor({
      source: source,
      baseLinePosition: this.baseLinePosition,
      resourcePath: this.resourcePath,
      componentStyleId: this.componentStyleId
    });
    try {
      return visitor.visit(tree);
    } catch (ex) {
      // debugger;
      console.error(ex);
      return {
        aliasImports: '',
        imports: '',
        renderFn: replaceTplStr(TPL.ERROR, {
          POSTFIX: CORE_UNIQUE_POSTFIX
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
    console.error(`Error occur at line ${tokenPosition.line + this.baseLinePosition - 1}, column ${tokenPosition.column}:
  > ${source.substring(idx, eidx > idx ? eidx : source.length)}
  > ${this.resourcePath}
  > ${msg}`);
  }
}

module.exports = {
  CORE_UNIQUE_POSTFIX,
  ALIAS_UNIQUE_POSTFIX,
  TemplateParser: JingeTemplateParser,
  aliasManager: aliasManager
};
