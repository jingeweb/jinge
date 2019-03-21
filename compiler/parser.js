const { Parser } = require('acorn');
const acornWalk = require('acorn-walk');
const escodegen = require('escodegen');
const path = require('path');
const { TemplateParser } = require('./template');

const { prependTab, isString, isArray, arrayIsEqual } = require('./util');
const RND_ID = require('crypto').randomBytes(5).toString('hex');
const jingeUtilFile = path.resolve(__dirname, '../src/util/index.js');

function _n_wrap(attrArgName) {
  return {
    'type': 'VariableDeclaration',
    'declarations': [
      {
        'type': 'VariableDeclarator',
        'id': {
          'type': 'Identifier',
          'name': `vm_${RND_ID}`
        },
        'init': {
          'type': 'CallExpression',
          'callee': {
            'type': 'Super',
          },
          'arguments': [{
            'type': 'Identifier',
            'name': attrArgName
          }]
        }
      }
    ],
    'kind': 'const'
  };
}

function _n_vm(idx, stmt, an, props) {
  return [{
    'type': 'VariableDeclaration',
    'declarations': [
      {
        'type': 'VariableDeclarator',
        'id': {
          'type': 'Identifier',
          'name': `fn_${RND_ID}_${idx}`
        },
        'init': {
          'type': 'ArrowFunctionExpression',
          'id': null,
          'params': [],
          'body': {
            'type': 'BlockStatement',
            'body': [
              stmt
            ]
          },
          'generator': false,
          'expression': false,
          'async': false
        }
      }
    ],
    'kind': 'const'
  },
  {
    'type': 'ExpressionStatement',
    'expression': {
      'type': 'CallExpression',
      'callee': {
        'type': 'Identifier',
        'name': `fn_${RND_ID}_${idx}`
      },
      'arguments': []
    }
  }].concat(props.map(prop => {
    return {
      'type': 'ExpressionStatement',
      'expression': {
        'type': 'CallExpression',
        'callee': {
          'type': 'MemberExpression',
          'computed': true,
          'object': {
            'type': 'Identifier',
            'name': an
          },
          'property': {
            'type': 'Identifier',
            'name': `VM_ON_${RND_ID}`
          }
        },
        'arguments': [isArray(prop) ? {
          'type': 'ArrayExpression',
          'elements': prop.map(p => ({
            type: 'Literal',
            value: p,
            raw: JSON.stringify(p)
          }))
        } : {
          'type': 'Literal',
          'value': prop,
          'raw': JSON.stringify(prop)
        }, {
          'type': 'Identifier',
          'name': `fn_${RND_ID}_${idx}`
        }]
      }
    };
  }));
}

class ComponentParser {
  static parse(content, options = {}) {
    return (new ComponentParser(options)).parse(content);
  }
  constructor(options) {
    this.jingeBase = options.jingeBase;
    this.resourcePath = options.resourcePath;
    this.webpackLoaderContext = options.webpackLoaderContext;
    if (!this.webpackLoaderContext) throw new Error('unimpossible?!');
    const defaultBase = {
      Component: [
        path.resolve(__dirname, '../src/index.js'),
        path.resolve(__dirname, '../src/core/component.js')
      ]
    };
    const cbase = options.componentBase || {};
    for (const n in cbase) {
      const v = Array.isArray(cbase[n]) ? cbase[n] : [cbase[n]];
      if (n in defaultBase) {
        defaultBase[n] = defaultBase[n].concat(v);
      } else {
        defaultBase[n] = v;
      }
    }
    this.componentBase = defaultBase;
    this.componentAlias = options.componentAlias;
    this.componentBaseLocals = new Map();
    this.isProduction = !!options.isProduction;
    this.tabSize = options.tabSize;
    if (typeof this.tabSize !== 'number' || this.tabSize <= 0) {
      this.tabSize = 0; // zero means will guess it.
    }
    this._replaces = null;
    this._needRemoveSymbolDesc = false;
    this._constructorImports = null;

    this._templateGlobalImports = null;
    this._templateLocalImports = [];
    this._templateAliasImports = [];
  }
  _walkAcorn(node, visitors) {
    const baseVisitor = acornWalk.base;
    (function c(node, st, override) {
      const found = visitors[node.type] || (override ? visitors[override] : null);
      let stopVisit = false;
      if (found) {
        if (found(node, st) === false) stopVisit = true;
      }
      if (!stopVisit) {
        baseVisitor[override || node.type](node, st, c);
      }
    })(node);
  }
  async walkImport(node) {
    let source = null;
    for (let i = 0; i < node.specifiers.length; i++) {
      const spec = node.specifiers[i];
      const type = spec.type;
      let imported = '';
      if (type === 'ImportDefaultSpecifier') {
        // `import a from 'xx'` -> const a = xx;
        imported = 'default';
      } else if (type === 'ImportSpecifier') {
        // `import { a as b } from 'xx' -> const b = xx.a;
        imported = spec.imported.name;
      }
      if (!imported) continue;
      if (this.isProduction && imported === 'Symbol') {
        if (!source) {
          source = await new Promise((resolve, reject) => {
            this.webpackLoaderContext.resolve(this.webpackLoaderContext.context, node.source.value, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        }
        if (source === jingeUtilFile) {
          this._needRemoveSymbolDesc = true;
        }
      }
      if (imported in this.componentBase) {
        if (!source) {
          source = await new Promise((resolve, reject) => {
            this.webpackLoaderContext.resolve(this.webpackLoaderContext.context, node.source.value, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        }
        if (this.componentBase[imported].indexOf(source) >= 0) {
          this.componentBaseLocals.set(spec.local.name, true);
          return true;
        }
      }
    }
    return false;
  }
  walkClass(node) {
    const sc = node.superClass;
    if (sc.type !== 'Identifier' || !this.componentBaseLocals.has(sc.name)) {
      /* TODO: need to support more cases? */
      return;
    }

    let c = 0;
    for (let i = 0; i < node.body.body.length; i++) {
      const mem = node.body.body[i];
      if (mem.type !== 'MethodDefinition') continue;
      if (mem.kind === 'constructor') {
        this.walkConstructor(mem, node.id.name);
        c |= 1;
        if (c === 3) break;
      } else if (mem.kind === 'get' && mem.static && mem.key.name === 'template') {
        this.walkTemplate(mem);
        c |= 2;
        if (c === 3) break;
      }
    }
  }
  _addConstructorImports() {
    if (!this._constructorImports) {
      this._constructorImports = `
import {
  VM_ON as VM_ON_${RND_ID}
} from '${this.jingeBase}/src/viewmodel/notify';
import {
  wrapComponent as wrapComponent_${RND_ID}
} from '${this.jingeBase}/src/viewmodel/proxy';
`;
    }
  }

  _parse_mem_path(memExpr, attrsName) {
    const paths = [];
    let computed = -1;
    let root = null;
    const walk = node => {
      const objectExpr = node.object;
      const propertyExpr = node.property;
      if (node.computed) {
        if (propertyExpr.type === 'Literal') {
          paths.unshift(propertyExpr.value);
          if (computed < 0) computed = 0;
        } else {
          computed = 1;
          paths.unshift(null);
        }
      } else {
        if (propertyExpr.type !== 'Identifier') {
          throw new Error('not support');
        } else {
          paths.unshift(propertyExpr.name);
        }
      }
      if (objectExpr.type === 'Identifier') {
        root = objectExpr;
        paths.unshift(objectExpr.name);
      } else {
        if (objectExpr.type !== 'MemberExpression') {
          throw new Error('not support');
        } else {
          walk(objectExpr);
        }
      }
    };

    try {
      walk(memExpr);
    } catch (ex) {
      return null;
    }

    if (root.name !== attrsName) {
      return null;
    }

    if (computed > 0) {
      console.error('Warning: computed member expression is not supported.');
      console.error(`  > ${this.resourcePath}, line ${memExpr.loc.start.line}`);
      return null;
    }

    return computed < 0 ? paths.slice(1).join('.') : paths.slice(1);
  }
  walkConstructor(node, ClassName) {
    const fn = node.value;
    const an = fn.params.length === 0 ? null : fn.params[0].name;
    if (!an) throw new Error(`constructor of ${ClassName} must accept at least one argument.`);
    let foundSupper = false;
    const vm = `vm_${RND_ID}`;
    const replaceThis = stmt => {
      this._walkAcorn(stmt, {
        MemberExpression: mem => {
          if (mem.object.type === 'ThisExpression') {
            mem.object = {
              type: 'Identifier',
              name: vm
            };
            return false;
          }
        }
      });
      return stmt;
    };
    const newBody = [];
    let guessTabSize = this.tabSize > 0 ? this.tabSize : 2; // default guess is 2
    fn.body.body.forEach((stmt, i) => {
      if (i === 0 && this.tabSize <= 0) {
        guessTabSize = stmt.loc.start.column - node.loc.start.column;
        if (guessTabSize <= 0) guessTabSize = 2;
      }
      if (stmt.type === 'ReturnStatement') {
        throw new Error(`constructor of '${ClassName}' can't have return statement.`);
      }
      if (stmt.type !== 'ExpressionStatement') {
        newBody.push(replaceThis(stmt));
        return;
      }
      const expr = stmt.expression;
      if (expr.type === 'CallExpression') {
        if (expr.callee.type === 'Super') {
          if (expr.arguments.length === 0 || expr.arguments[0].name !== an) {
            throw new Error(`constructor of ${ClassName} must pass first argument '${an}' to super-class`);
          }
          foundSupper = true;
          newBody.push(_n_wrap(an));
        } else {
          newBody.push(replaceThis(stmt));
        }
      } else if (expr.type === 'AssignmentExpression') {
        if (expr.left.type !== 'MemberExpression' || expr.left.object.type !== 'ThisExpression') {
          newBody.push(replaceThis(stmt));
          return;
        }
        if (!foundSupper) throw new Error('can\'t use \'this\' before call super().');
        const props = [];
        const addProp = p => {
          if (isString(p) && props.indexOf(p) < 0) props.push(p);
          if (isArray(p) && !props.find(sp => arrayIsEqual(sp, p))) props.push(p);
        };
        this._walkAcorn(expr.right, {
          MemberExpression: node => {
            const paths = this._parse_mem_path(node, an);
            if (paths) addProp(paths);
            return false;
          }
        });
        if (props.length > 0) {
          newBody.push(..._n_vm(i, replaceThis(stmt), an, props));
        } else {
          newBody.push(replaceThis(stmt));
        }
      } else {
        newBody.push(replaceThis(stmt));
      }
    });
    newBody.push({
      'type': 'ReturnStatement',
      'argument': {
        'type': 'Identifier',
        'name': `vm_${RND_ID}`
      }
    });
    fn.body.body = newBody;
    let newCode = escodegen.generate(fn.body, {
      indent: ''.padStart(guessTabSize, ' ')
    });
    if (node.loc.start.column > 0) {
      const i = newCode.indexOf('\n');
      newCode = newCode.substring(i + 1);
      newCode = prependTab(newCode, false, node.loc.start.column);
      newCode = '{\n' + newCode;
    }
    this._addConstructorImports();
    this._replaces.push({
      start: fn.body.start,
      end: fn.body.end,
      code: newCode
    });
  }
  walkTemplate(node) {
    if (node.value.body.body.length === 0) throw new Error('static getter `template` must return.');
    const st = node.value.body.body[0];
    if (st.type !== 'ReturnStatement') {
      throw new Error('static getter `template` must return directly.');
    }
    let guessTabSize = this.tabSize > 0 ? this.tabSize : 2; // default guess is 2
    if (this.tabSize <= 0) {
      guessTabSize = st.loc.start.column - node.loc.start.column;
      if (guessTabSize <= 0) guessTabSize = 2;
    }
    const arg = st.argument;
    let tpl = '';
    if (arg.type === 'Identifier') {
      return;
    } else if (arg.type === 'Literal') {
      tpl = arg.value;
    } else if (arg.type === 'TemplateLiteral') {
      if (arg.expressions.length > 0) throw new Error('static getter `template` must not return template string with expression.');
      tpl = arg.quasis[0].value.cooked;
    } else {
      throw new Error(`Type '${arg.type}' of return in static getter 'template' is not support.`);
    }
    const result = TemplateParser._parse(tpl, {
      baseLinePosition: arg.loc.start.line,
      resourcePath: this.resourcePath,
      tabSize: guessTabSize,
      wrapCode: false,
      componentAlias: this.componentAlias
    });
    if (!this._templateGlobalImports) {
      this._templateGlobalImports = result.globalImports;
    } else if (this._templateGlobalImports !== result.globalImports) {
      throw new Error('impossible?!');
    }
    if (result.aliasImports.trim()) {
      this._templateAliasImports.push(result.aliasImports);
    }

    if (result.localImports.trim()) {
      this._templateLocalImports.push(result.localImports);
    }

    let code = result.renderFn;
    if (st.loc.start.column > 0) {
      code = 'function(component) {\n' + prependTab(code.substring(code.indexOf('\n') + 1), false, st.loc.start.column);
    }

    this._replaces.push({
      start: st.argument.start,
      end: st.argument.end,
      code
    });
  }
  async parse(code) {
    const comments = [];
    let tree;
    try {
      tree = Parser.parse(code, {
        ranges: true,
        locations: true,
        ecmaVersion: 2019,
        sourceType: 'module',
        onComment: comments
      });
    } catch (ex) {
      throw new Error(ex.message + ' @ ' + this.resourcePath);
    }
    tree.comments = comments;
    let needHandleComponent = false;

    this._replaces = [];
    for (let i = 0; i < tree.body.length; i++) {
      const n = tree.body[i];
      if (n.type === 'ImportDeclaration') {
        if ((await this.walkImport(n))) {
          needHandleComponent = true;
          break;
        }
      }
      // in production mode, we remove symbol description to decrease file size
      if (this._needRemoveSymbolDesc && (n.type === 'VariableDeclaration' || n.type === 'ExportNamedDeclaration')) {
        this._walkAcorn(n, {
          CallExpression: node => {
            if (node.callee.name === 'Symbol') {
              const args = node.arguments;
              if (args.length === 0) return false;
              if (args.length > 1) {
                throw new Error('Symbol() arguments more than one.');
              }
              this._replaces.push({
                start: args[0].start,
                end: args[0].end,
                code: ''
              });
              return false;
            }
          }
        });
      }
    }
    if (needHandleComponent) {
      this._walkAcorn(tree, {
        ClassDeclaration: node => {
          if (node.superClass) {
            this.walkClass(node);
          }
          return false;
        }
      });
    }

    if (this._replaces.length === 0) {
      return {
        code,
        ast: tree
      };
    }

    this._replaces = this._replaces.sort((a, b) => a.start > b.start ? 1 : -1);
    let start = 0;
    let output = '';
    if (this._constructorImports) output += this._constructorImports + '\n';
    if (this._templateGlobalImports) output += this._templateGlobalImports + '\n';
    if (this._templateAliasImports.length > 0) output += this._templateAliasImports.join('\n') + '\n';
    if (this._templateLocalImports.length > 0) output += this._templateLocalImports.join('\n') + '\n';
    for (let i = 0; i < this._replaces.length; i++) {
      const r = this._replaces[i];
      if (r.start > start) output += code.substring(start, r.start);
      output += r.code;
      start = r.end;
    }
    if (start < code.length) output += code.substring(start);
    // console.log(output);
    return {
      code: output
    };
  }
}


module.exports = {
  ComponentParser
};
