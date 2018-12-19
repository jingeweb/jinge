const { Parser } = require('acorn');
const acornWalk = require('acorn-walk');
const escodegen = require('escodegen');
const path = require('path');
const { TemplateParser } = require('./template');
const { prependTab } = require('./util');
const RND_ID = require('crypto').randomBytes(5).toString('hex');
const jingeUtilFile = path.resolve(__dirname, '../src/util/index.js');

function _n_wrap() {
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
            'type': 'Identifier',
            'name': `wrapComponent_${RND_ID}`
          },
          'arguments': [
            {
              'type': 'ThisExpression'
            }
          ]
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
        'arguments': [
          {
            'type': 'Literal',
            'value': prop,
            'raw': JSON.stringify(prop)
          },
          {
            'type': 'Identifier',
            'name': `fn_${RND_ID}_${idx}`
          }
        ]
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
    this.webpackLoaderContext = options.webpackLoaderContext;
    if (!this.webpackLoaderContext) throw new Error('unimpossible?!');
    const defaultVms = {
      Component: [
        path.resolve(__dirname, '../src/index.js'),
        path.resolve(__dirname, '../src/core/component.js')
      ]
    };
    const vms = options.vmRelfections || {};
    for (const n in vms) {
      const v = Array.isArray(vms[n]) ? vms[n] : [vms[n]];
      if (n in defaultVms) {
        defaultVms[n] = defaultVms[n].concat(v);
      } else {
        defaultVms[n] = v;
      }
    }
    this.vmReflections = defaultVms;
    this.componentAliases = options.componentAliases;
    this.vmLocals = new Map();
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
    this._templateAliasImports = null;
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
      if (type === 'ImportDefaultSpecifier' || type === 'ImportNamespaceSpecifier') {
        // `import a from 'xx'` -> const a = xx;
        imported = spec.local.name;
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
      if (imported in this.vmReflections) {
        if (!source) {
          source = await new Promise((resolve, reject) => {
            this.webpackLoaderContext.resolve(this.webpackLoaderContext.context, node.source.value, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        }
        if (this.vmReflections[imported].indexOf(source) >= 0) {
          this.vmLocals.set(spec.local.name, true);
          return true;
        }
      }
    }
    return false;
  }
  walkClass(node) {
    const sc = node.superClass;
    if (sc.type !== 'Identifier' || !this.vmLocals.has(sc.name)) {
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
    if ((c & 1) === 0) {
      // constructor not found, insert.
      this._addConstructorImports();
      this._replaces.push({
        start: node.body.start + 1,
        end: node.body.start + 1,
        code: `
  constructor(attrs) {
    super(attrs);
    if (attrs !== null && typeof attrs === 'object') {
      const props = Object.keys(attrs);
      props.forEach(p => this[p] = attrs[p]);

      const vm_${RND_ID} = wrapComponent_${RND_ID}(this);
      props.filter(k => /^[a-zA-Z]/.test(k)).forEach(k => {
        attrs[VM_ON_${RND_ID}](k, () => vm_${RND_ID}[k] = attrs[k]);
      });
      return vm_${RND_ID};
    } else {
      return wrapComponent_${RND_ID}(this);      
    }
  }`
      });
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
        newBody.push(replaceThis(stmt));
        if (expr.callee.type === 'Super') {
          if (expr.arguments.length === 0 || expr.arguments[0].name !== an) {
            throw new Error(`constructor of ${ClassName} must pass first argument '${an}' to super-class`);
          }
          foundSupper = true;
          newBody.push(_n_wrap());
        }
      } else if (expr.type === 'AssignmentExpression') {
        if (expr.left.type !== 'MemberExpression' || expr.left.object.type !== 'ThisExpression') {
          newBody.push(replaceThis(stmt));
          return;
        }
        if (!foundSupper) throw new Error('can\'t use \'this\' before call super().');
        const props = [];
        const addProp = p => {
          if (props.indexOf(p) < 0) props.push(p);
        };
        this._walkAcorn(expr.right, {
          MemberExpression: mem => {
            if (mem.object.name !== an) return false;
            const p = mem.property;
            if (p.type === 'Identifier') {
              if (!p.name.startsWith('_')) {
                addProp(p.name);
              }
            } else if (p.type === 'Literal') {
              if (!('' + p.value).startsWith('_')) {
                addProp(p.value);
              }
            } else {
              throw new Error('unsupport type.');
            }
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
      tabSize: guessTabSize,
      wrapCode: false,
      componentAliases: this.componentAliases
    });
    if (this._templateGlobalImports && this._templateGlobalImports !== result.globalImports) {
      throw new Error('impossible?!');
    }
    if (this._templateAliasImports && this._templateAliasImports !== result.aliasImports) {
      throw new Error('impossible?!');
    }
    if (!this._templateGlobalImports) this._templateGlobalImports = result.globalImports;
    if (!this._templateAliasImports) this._templateAliasImports = result.aliasImports;
    
    this._templateLocalImports.push(result.localImports);

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
    const tree = Parser.parse(code, {
      ranges: true,
      locations: true,
      ecmaVersion: 2019,
      sourceType: 'module',
      onComment: comments
    });
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
    if (this._templateAliasImports) output += this._templateAliasImports;
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
