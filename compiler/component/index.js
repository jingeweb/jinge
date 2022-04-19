const path = require('path');
const { Parser } = require('acorn');
const acornWalk = require('acorn-walk');
const escodegen = require('escodegen');
const { sharedOptions } = require('../options');
const { TemplateParser } = require('../template');
const { prependTab, isString, isArray, arrayIsEqual, getJingeBase } = require('../util');
const { i18nManager } = require('../i18n');
const baseManager = require('./base');
const { _n_vm, _n_wrap } = require('./helper');

class ComponentParser {
  static parse(content, sourceMap, options) {
    return new ComponentParser(options).parse(content);
  }

  constructor(options) {
    this.resourcePath = options.resourcePath;
    this.jingeBase = getJingeBase(this.resourcePath);
    this.webpackLoaderContext = options.webpackLoaderContext;
    this._localStore = {
      templates: new Map(),
    };
    if (!this.webpackLoaderContext) throw new Error('unimpossible?!');

    this._constructorRanges = [];
    this._replaces = null;
    this._needHandleI18NTranslate = false;

    this._tplGlobalImports = new Set();
    this._tplCodeOfImports = new Set();
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

  _resolve(node) {
    return new Promise((resolve, reject) => {
      this.webpackLoaderContext.resolve(this.webpackLoaderContext.context, node.source.value, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  async walkImport(node) {
    if (node.specifiers.length === 0) {
      return false;
    }
    let source = null;
    let testSource = node.source.value;
    if (!/\.\w+$/.test(testSource)) {
      source = await this._resolve(node);
      testSource = source;
    }
    const _isHtml = /\.htm(?:l)?$/.test(testSource);
    let needHandleComponent = false;
    for (let i = 0; i < node.specifiers.length; i++) {
      const spec = node.specifiers[i];
      const type = spec.type;
      let imported = '';
      let local = '';
      if (type === 'ImportDefaultSpecifier') {
        // `import a from 'xx'` -> const a = xx;
        imported = 'default';
        local = spec.local.name;
      } else if (type === 'ImportSpecifier') {
        // `import { a as b } from 'xx' -> const b = xx.a;
        imported = spec.imported.name;
        local = spec.local.name;
      }

      if (!imported) {
        continue;
      }

      if (_isHtml) {
        if (!source) {
          source = await this._resolve(node);
        }
        if (_isHtml) {
          this._localStore.templates.set(local, source);
        }
        return false;
      }

      /**
       * 如果使用了 _t 这个多语言编译辅助函数，则自动将函数的参数注册到多语言字典里并将
       * 该函数调用 `_t(text, params)` 转换成 `i18n[I18N_GET_TEXT](key, params)`
       *
       * 但如果多语言脚本资源已经处理过了（i18nManager.written === true），说明是在
       * 启用了 watch 的研发模式下，文件发生变化后重新编译，这种情况下，由于多方面的复杂
       * 问题不好解决，暂时先简化为不做多语言的处理（事实上，研发模式下也不需要频繁切换多语言，
       * 往往是在默认语言下将模块开发完成，然后更新其它语言包，再重新运行和测试其它语言）。
       */
      if (!i18nManager.written && imported === '_t') {
        if (node.source.value === 'jinge' && local !== '_t') {
          /**
           * 为了简化逻辑，要求从 jinge 中引入 _t 这个 i18n 翻译用途的函数时，
           * 不能指定其它本地变量别名。即，
           * import {_t} from 'jinge'  // correct!
           * import {_t as someAlias} from 'jinge'  // wrong!
           */
          throw new Error("_t is preserve i18n symbol, can't have local alias name. see https://todo.");
        }
        if (local === '_t' && node.source.value === 'jinge') {
          // console.log('found _t', this.resourcePath);
          this._needHandleI18NTranslate = true;
        }
      }
      if (!needHandleComponent && imported in baseManager.componentBase) {
        if (!source) {
          // console.log(this.webpackLoaderContext.context, node.source.value);
          source = await this._resolve(node);
        }
        if (baseManager.componentBase[imported].indexOf(source) >= 0) {
          baseManager.componentBaseLocals.set(spec.local.name, true);
          needHandleComponent = true;
        }
      }
    }
    return needHandleComponent;
  }

  walkClass(node) {
    const sc = node.superClass;
    if (sc.type !== 'Identifier' || !baseManager.componentBaseLocals.has(sc.name)) {
      /* TODO: need to support more cases? */
      return;
    }

    let tplNode;

    for (let i = 0; i < node.body.body.length; i++) {
      const mem = node.body.body[i];
      if (mem.type !== 'MethodDefinition') continue;
      if (mem.kind === 'constructor') {
        this.walkConstructor(mem, node.id.name);
      } else if (mem.kind === 'get' && mem.static) {
        if (mem.key.name === 'template') {
          // this.walkTemplate(mem);
          tplNode = mem;
        }
      }
    }

    if (tplNode) {
      this.walkTemplate(tplNode);
    }
  }

  _addI18nImports() {
    this._tplCodeOfImports.add(
      `import { i18n as __i18n${sharedOptions.symbolPostfix} } from '${
        this.jingeBase === 'jinge' ? 'jinge' : path.join(this.jingeBase, 'core')
      }';`,
    );
  }

  _addConstructorImports() {
    this._tplCodeOfImports.add(
      `import { $$ as __$$${sharedOptions.symbolPostfix} } from '${
        this.jingeBase === 'jinge' ? 'jinge' : path.join(this.jingeBase, 'vm/common')
      }';`,
    );
  }

  _parse_mem_path(memExpr, attrsName) {
    let paths = [];
    let computed = -1;
    let root = null;
    const walk = (node) => {
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
      if (objectExpr.type === 'ThisExpression') {
        root = objectExpr;
      } else if (objectExpr.type === 'Identifier') {
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

    if (root.type !== 'Identifier' || root.name !== attrsName) {
      return null;
    }
    if (computed > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `Warning: computed member expression is not supported.\n  > ${this.resourcePath}, line ${memExpr.loc.start.line}`,
      );
      return null;
    }

    paths = paths.slice(1);
    const privateIdx = paths.findIndex((p) => p.startsWith('_'));
    if (privateIdx >= 0) return null;
    return computed < 0 ? paths.join('.') : paths;
  }

  walkConstructor(node, ClassName) {
    if (this._needHandleI18NTranslate) {
      // 处理出现在组件的构造函数里的 _t 函数。
      this.walkI18NTranslate(node, true);
      this._constructorRanges.push({
        start: node.start,
        end: node.end,
      });
    }

    const fn = node.value;
    const an = fn.params.length === 0 ? null : fn.params[0].name;
    if (!an) throw new Error(`constructor of ${ClassName} must accept at least one argument.`);
    let foundSupper = false;
    const vm = `__vm${sharedOptions.symbolPostfix}`;
    const replaceThis = (stmt) => {
      this._walkAcorn(stmt, {
        ThisExpression: (ts) => {
          ts.type = 'Identifier';
          ts.name = vm;
          return false;
        },
      });
      return stmt;
    };
    const newBody = [];
    fn.body.body.forEach((stmt, i) => {
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
          newBody.push(stmt);
          newBody.push(_n_wrap(sharedOptions.symbolPostfix));
        } else {
          newBody.push(replaceThis(stmt));
        }
      } else if (expr.type === 'AssignmentExpression') {
        const exprLeft = expr.left;
        if (
          exprLeft.type !== 'MemberExpression' ||
          exprLeft.object.type !== 'ThisExpression' ||
          exprLeft.property.type !== 'Identifier' ||
          exprLeft.property.name.startsWith('_') ||
          exprLeft.computed
        ) {
          newBody.push(replaceThis(stmt));
          return;
        }
        if (!foundSupper) throw new Error("can't use 'this' before call super().");
        const props = [];
        const addProp = (p) => {
          if (isString(p) && props.indexOf(p) < 0) props.push(p);
          if (isArray(p) && !props.find((sp) => arrayIsEqual(sp, p))) props.push(p);
        };
        this._walkAcorn(expr.right, {
          MemberExpression: (node) => {
            const paths = this._parse_mem_path(node, an);
            if (paths) addProp(paths);
            return false;
          },
        });
        if (props.length > 0) {
          newBody.push(..._n_vm(i, replaceThis(stmt), an, props, sharedOptions.symbolPostfix));
        } else {
          newBody.push(replaceThis(stmt));
        }
      } else {
        newBody.push(replaceThis(stmt));
      }
    });
    fn.body.body = newBody;
    let newCode = escodegen.generate(fn.body, {
      indent: ''.padStart(2, ' '),
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
      code: newCode,
    });
  }

  walkTemplate(node) {
    if (node.value.body.body.length === 0) throw new Error('static getter `template` must return.');
    const st = node.value.body.body[0];
    if (st.type !== 'ReturnStatement') {
      throw new Error('static getter `template` must return directly.');
    }
    const arg = st.argument;
    let tpl = '';
    if (arg.type === 'Identifier') {
      if (!this._localStore.templates.has(arg.name)) {
        throw new Error('static getter `template` must return variable imported on file topest level.');
      }
      return;
    } else if (arg.type === 'Literal') {
      tpl = arg.value;
    } else if (arg.type === 'TemplateLiteral') {
      if (arg.expressions.length > 0)
        throw new Error('static getter `template` must not return template string with expression.');
      tpl = arg.quasis[0].value.cooked;
    } else {
      throw new Error(`Type '${arg.type}' of return in static getter 'template' is not support.`);
    }
    const result = TemplateParser._parse(tpl, {
      baseLinePosition: arg.loc.start.line,
      resourcePath: this.resourcePath,
      webpackLoaderContext: this.webpackLoaderContext,
      wrapCode: false,
    });

    result.globalImports.forEach((imp) => this._tplGlobalImports.add(imp));
    result.aliasImports && this._tplCodeOfImports.add(result.aliasImports);
    result.localImports && this._tplCodeOfImports.add(result.localImports);
    result.i18nDeps && this._tplCodeOfImports.add(result.i18nDeps);

    let code = result.renderFn;
    if (st.loc.start.column > 0 && code.indexOf('\n') > 0) {
      code = 'function(component) {\n' + prependTab(code.substring(code.indexOf('\n') + 1), false, st.loc.start.column);
    }

    this._replaces.push({
      start: st.argument.start,
      end: st.argument.end,
      code,
    });
  }

  walkI18NTranslate(rootNode, inConstructor) {
    this._walkAcorn(rootNode, {
      CallExpression: (node) => {
        if (node.callee.type === 'Identifier' && node.callee.name === '_t') {
          /**
           * inConstructor 为 false 说明不是从 this.walkConstructor 中进入到此处的逻辑，
           * 这种情况下，不需要再处理出现在组件的构造函数里的 _t 函数，
           * 因为之前在 this.walkConstructor 中已经处理过了。
           */
          if (
            !inConstructor &&
            this._constructorRanges.some((r) => {
              return node.start <= r.end && node.end >= r.start;
            })
          ) {
            return;
          }
          const args = node.arguments;
          if (args.length === 0 || args.length > 3) {
            throw new Error('_t require count of arguments to be 1 to 3.');
          }
          const text = args[0];
          if (!text || text.type !== 'Literal' || typeof text.value !== 'string') {
            throw new Error('_t require first argument to be literal string.');
          }
          this._addI18nImports();
          node.callee = {
            type: 'MemberExpression',
            computed: false,
            object: {
              type: 'Identifier',
              name: `__i18n${sharedOptions.symbolPostfix}`,
            },
            property: {
              type: 'Identifier',
              name: `__t`,
            },
          };
          const key = i18nManager.registerToDict(text.value, this.resourcePath);
          text.value = key;
          /*
           * 如果 _t 函数调用不是在组件的构造函数里，则需要将 _t 函数代码转换；
           * 否则，只需要将 ast tree node 的数据修改就行，在 walkConstructor 里会整体替换。
           */
          if (!inConstructor) {
            const code = escodegen.generate(node);
            this._replaces.push({
              start: node.start,
              end: node.end,
              code,
            });
          }
        }
      },
    });
  }

  async parse(code) {
    const comments = [];
    let tree;
    try {
      tree = Parser.parse(code, {
        ranges: true,
        locations: true,
        ecmaVersion: 2020,
        sourceType: 'module',
        onComment: comments,
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
        if (await this.walkImport(n)) {
          needHandleComponent = true;
        }
      }
    }
    if (needHandleComponent) {
      this._walkAcorn(tree, {
        ClassDeclaration: (node) => {
          if (node.superClass) {
            this.walkClass(node);
          }
          return false;
        },
      });
    }

    if (this._needHandleI18NTranslate) {
      // 处理出现在除了组件的构造函数外其它地方的 _t 函数
      this.walkI18NTranslate(tree, false);
    }
    if (this._replaces.length === 0) {
      return {
        code,
      };
    }

    this._replaces = this._replaces.sort((a, b) => (a.start > b.start ? 1 : -1));
    let start = 0;
    let output =
      this._tplGlobalImports.size > 0 ? `import { ${[...this._tplGlobalImports].join(', ')} } from 'jinge';\n` : '';
    output += [...this._tplCodeOfImports].join('\n');
    for (let i = 0; i < this._replaces.length; i++) {
      const r = this._replaces[i];
      if (r.start > start) {
        output += code.substring(start, r.start);
      }
      output += r.code;
      start = r.end;
    }
    if (start < code.length) {
      output += code.substring(start);
    }
    return {
      code: output,
    };
  }
}

module.exports = {
  ComponentParser,
  componentBaseManager: baseManager,
};
