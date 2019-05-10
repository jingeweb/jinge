
const RND_ID = require('crypto').randomBytes(4).toString('hex');
const helper = require('./helper');
const { TemplateVisitor } = require('./TemplateVisitor');
const {
  replaceTplStr
} = require('../util');
const TPL = require('./tpl');

const IMPORTS = (function() {
  const map = {
    'jinge/dom': 'createTextNode,createComment,createElement,createElementWithoutAttrs,createFragment,'
      + 'appendText,appendChild,setText,setAttribute,removeAttribute,setInputValue,addEvent',
    'jinge/viewmodel/notify': 'VM_ON,VM_NOTIFY,VM_OFF',
    'jinge/viewmodel/common': 'VM_DEBUG_NAME',
    'jinge/core/component': 'assertRenderResults,emptyRenderFn,errorRenderFn,textRenderFn,SET_REF_NODE,CONTEXT,NON_ROOT_COMPONENT_NODES,ROOT_NODES,ARG_COMPONENTS,RENDER',
    'jinge/viewmodel/proxy': 'wrapViewModel,wrapAttrs',
    'jinge/util': 'STR_EMPTY,STR_DEFAULT,arrayEqual',
    'jinge/components/parameter': 'ParameterComponent'
  };
  const rtn = {
    code: '',
    map: {}
  };
  Object.keys(map).forEach(dep => {
    rtn.code += `import {
  ${map[dep].split(',').map(it => it.trim()).filter(it => !!it).map(it => {
    if (it in rtn.map) throw new Error('dulplicated.');
    rtn.map[it] = `${it}_${RND_ID}`;
    return `${it} as ${it}_${RND_ID}`;
  }).join(', ')}
} from '${dep}';\n`;
  });
  // import all constants
  rtn.code += `import * as JINGE_CONSTS_${RND_ID} from 'jinge/util/const';\n`;
  return rtn;
})();

class JingeTemplateParser {
  static _parse(content, options = {}) {
    const tplParser = new JingeTemplateParser(options);
    const result = tplParser.parse(content);
    return options.wrapCode !== false ? {
      code: IMPORTS.code + '\n' + result.aliasImports + '\n' + result.imports + `\nexport default ${result.renderFn}`
    } : {
      globalImports: IMPORTS.code,
      aliasImports: result.aliasImports,
      localImports: result.imports,
      renderFn: result.renderFn
    };
  }
  static async parse(content, sourceMap, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        resolve(JingeTemplateParser._parse(content, options));
      } catch(err) {
        reject(err);
      }
    });
  }
  constructor(options) {
    this.tabSize = options.tabSize || 2;
    this.alias = options.componentAlias;
    this.resourcePath = options.resourcePath;
    this.baseLinePosition = options.baseLinePosition || 1;
    this.needCompress = options.needCompress;
    this.i18nOptions = options.i18n;
    this.i18nManager = options.componentStyleStore.i18n;
    const info = options.componentStyleStore.templates.get(this.resourcePath);
    this.componentStyleId = options.componentStyleId || (
      info ? info.styleId : null
    );
  }
  parse(source) {
    if (!source.trim()) return {
      aliasImports: '',
      imports: '',
      renderFn: replaceTplStr(TPL.EMPTY, {ID: RND_ID})
    };
    const [meetErr, tree] = helper.parse(source);
    if (meetErr) {
      this._logParseError(source, meetErr, 'syntax of template is error.');
      return {
        aliasImports: '',
        imports: '',
        renderFn: replaceTplStr(TPL.ERROR, {ID: RND_ID})
      };
    }
    const visitor = new TemplateVisitor({
      source: source,
      i18n: this.i18nOptions,
      i18nManager: this.i18nManager,
      needCompress: this.needCompress,
      baseLinePosition: this.baseLinePosition,
      resourcePath: this.resourcePath,
      tabSize: this.tabSize,
      alias: this.alias,
      rndId: RND_ID,
      componentStyleId: this.componentStyleId
    });
    try {
      return visitor.visit(tree);
    } catch(ex) {
      // debugger;
      // console.error(ex);
      return {
        aliasImports: '',
        imports: '',
        renderFn: replaceTplStr(TPL.ERROR, {ID: RND_ID})
      };
    }
  }
  _logParseError(source, tokenPosition, msg) {
    let idx = -1;
    for(let i = 0; i < tokenPosition.line - 1; i++) {
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
  TemplateParser: JingeTemplateParser
};
