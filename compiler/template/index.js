
const { TemplateParser } = require('./parser/TemplateParser');
const { TemplateLexer } = require('./parser/TemplateLexer');
const RND_ID = require('crypto').randomBytes(4).toString('hex');
const antlr = require('antlr4/index');
const { TemplateVisitor } = require('./TemplateVisitor');
const {
  replaceTplStr
} = require('../util');
const TPL = require('./tpl');

const IMPORTS = (function() {
  const map = {
    'jinge/src/dom': 'createTextNode,createComment,createElement,createElementWithoutAttrs,createFragment,'
      + 'appendText,appendChild,setText,setAttribute,setInputValue,addEvent',
    'jinge/src/viewmodel/notify': 'VM_ON,VM_NOTIFY',
    'jinge/src/core/component': 'assertRenderResults,CONTEXT,NON_ROOT_COMPONENT_NODES,ROOT_NODES,REF_NODES,ARG_COMPONENTS,RENDER',
    'jinge/src/viewmodel/proxy': 'wrapViewModel',
    'jinge/src/util': 'STR_EMPTY,STR_DEFAULT'
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
  return rtn;
})();

class JingeTemplateParser {
  static _parse(content, options = {}) {
    const tplParser = new JingeTemplateParser(options);
    const result = tplParser.parse(content);
    return options.wrapCode !== false ? {
      code: IMPORTS.code + '\n' + result.aliasImports + '\n' + result.imports + `export default ${result.renderFn}`
    } : {
      globalImports: IMPORTS.code,
      aliasImports: result.aliasImports,
      localImports: result.imports,
      renderFn: result.renderFn
    };
  }
  static async parse(content, options = {}) {
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
    this.alias = options.componentAliases;
  }
  parse(content) {
    content = content.trim();
    if (!content) return {
      aliasImports: '',
      imports: '',
      renderFn: replaceTplStr(TPL.EMPTY, {ID: RND_ID})
    };

    const lexer = new TemplateLexer(new antlr.InputStream(content));
    const tokens = new antlr.CommonTokenStream(lexer);
    // console.log(lexer.getAllTokens().map(t => {
    //   console.log(t.text);
    //   return  t.text;
    // }));
    // process.exit(0);
    // debugger;
    const parser = new TemplateParser(tokens);
    // parser.removeErrorListeners();
    // parser.addErrorListener({
    //   syntaxError(recognizer, offendingSymbol, ...args) {
    //     debugger;
    //     console.log(...args);
    //   },
    //   reportContextSensitivity() {},
    //   reportAttemptingFullContext() {},
    //   reportAmbiguity() {}
    // });
    const tree = parser.html();
    const visitor = new TemplateVisitor({
      tabSize: this.tabSize,
      alias: this.alias,
      rndId: RND_ID
    });
    return visitor.visit(tree);
  }
}

module.exports = {
  TemplateParser: JingeTemplateParser
};
