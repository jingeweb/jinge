const escodegen = require('escodegen');
const crypto = require('crypto');
const acorn = require('acorn');
const acornWalk = require('acorn-walk');
const HTMLTags = require('html-tags');
const { TemplateParserVisitor } = require('./parser/TemplateParserVisitor');
const { TemplateParser } = require('./parser/TemplateParser');
const { AttributeValueParser } = require('./AttributeValueParser');
const { HTML_BOOL_IDL_ATTRS, HTML_COMMON_IDL_ATTRS } = require('./const');

const {
  replaceTplStr,
  prependTab
} = require('../util');

const TPL = require('./tpl');
const KNOWN_ATTR_TYPES = [
  /* bellow is parameter related attribute types */
  /* s is just alias of str */
  'expr', 'e', 'str', 's',
  /* bellow is message/event related attribute type */
  'on',
  /* bellow is compiler related attribute types */
  'vm', 'arg', 'ref'
];

function mergeAlias(src, dst) {
  if (src) for (const k in src) {
    if (!src[k] || typeof src[k] !== 'object') throw new Error('bad alias format');
    if (k in dst) {
      Object.assign(dst[k], src[k]);
    } else {
      dst[k] = src[k];
    }
  }
  return dst;
}

class TemplateVisitor extends TemplateParserVisitor {
  constructor(opts) {
    super();
    this._stack = [];
    this._vms = [];
    this._id = opts.rndId;
    this._tplId = crypto.randomBytes(4).toString('hex');
    this._tabSize = opts.tabSize || 2;
    this._source = opts.source;
    this._resourcePath = opts.resourcePath;
    this._baseLinePosition = opts.baseLinePosition || 1;
    this._imports = {};
    this._importOutputCodes = [];
    this._needHandleComment = true;
    this._parent = { type: 'component', sub: 'normal' };
    const alias = mergeAlias(opts.alias, {
      jinge: {
        IfComponent: 'if',
        ForComponent: 'for',
        SwitchComponent: 'switch',
        Component: ['argument', 'parameter']
      }
    });
    this._alias = {};
    this._aliasImports = {};
    this._aliasLocalMap = {};
    for (const source in alias) {
      const m = alias[source];
      if (!this._aliasLocalMap[source]) this._aliasLocalMap[source] = {};
      Object.keys(m).map(c => {
        const rid = crypto.randomBytes(4).toString('hex');
        if (!(c in this._aliasLocalMap[source])) {
          this._aliasLocalMap[source][c] = c === 'default' ? `Component_${rid}` : `${c}_${rid}`;
        }
        const as = Array.isArray(m[c]) ? m[c] : [m[c]];
        as.forEach(a => this._alias[a] = [c, source]);
      });
    }
  }
  _logParseError(tokenPosition, msg) {
    let idx = -1;
    for(let i = 0; i < tokenPosition.line - 1; i++) {
      idx = this._source.indexOf('\n', idx + 1);
    }
    idx = idx + 1;
    const eidx = this._source.indexOf('\n', idx);
    console.error(`Error occur at line ${tokenPosition.line + this._baseLinePosition - 1}, column ${tokenPosition.column}:
  > ${this._source.substring(idx, eidx > idx ? eidx : this._source.length)}
  > ${this._resourcePath}
  > ${msg}`);
  }
  _throwParseError(tokenPosition, msg) {
    this._logParseError(tokenPosition, msg);
    throw new Error('parsing aborted as error occur.');
  }
  _replace_tpl(str, ctx) {
    ctx = ctx || {};
    ctx.ID = this._id;
    return replaceTplStr(str, ctx);
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
  _prependTab(str, replaceStartEndEmpty = false) {
    // console.log(this._tabSize);
    return prependTab(str, replaceStartEndEmpty, this._tabSize);
  }
  _enter(vms, info) {
    this._stack.push({
      vms: this._vms.slice(),
      parent: this._parent
    });
    this._parent = info;
    this._vms = this._vms.concat(vms || []);
  }
  _exit() {
    const r = this._stack.pop();
    this._vms = r.vms;
    this._parent = r.parent;
  }
  _parse_listener(str, mode) {
    const tree = acorn.Parser.parse(`function _() {\n ${str} \n}`);
    const block = tree.body[0].body;
    if (block.type !== 'BlockStatement') throw new Error('unimpossible?!');

    if (block.body.length === 1 && block.body[0].type === 'ExpressionStatement') {
      /**
       * if listener is identifer or member expression, conver it to function call.
       * for example, 
       * <SomeComponent on:click="someFn" />
       * is exactly same as:
       * <SomeComponent on:click="someFn(...args)"/>
       */
      const exp = block.body[0];
      if (exp.expression.type === 'Identifier' || exp.expression.type === 'MemberExpression') {
        exp.expression = {
          'type': 'CallExpression',
          'callee': exp.expression,
          'arguments': [{
            'type': 'SpreadElement',
            'argument': {
              'type': 'Identifier',
              'name': 'args'
            }
          }]
        };
      }
    }
    this._walkAcorn(block, {
      Identifier: node => {
        if (node.name === 'args') return false;
        if (mode === 'html' && node.name === '$event') {
          node.name = 'args[0]';
          return false;
        }
        const varName = node.name;
        const vmVar = this._vms.find(v => v.name === varName);
        const level = vmVar ? vmVar.level : 0;
        node.name = `vm_${level}.${vmVar ? vmVar.reflect : varName}`;
        return false;
      },
      CallExpression: node => {
        if (mode !== 'html') return;
        /**
         * we will replace all '$event' to 'args[0]' for html element listener
         */
        const args = node.arguments;
        if (!args || args.length === 0) return;
        args.forEach((a, i) => {
          if (a.type === 'Identifier' && a.name === '$event') {
            args[i] = {
              'type': 'MemberExpression',
              'computed': true,
              'object': {
                'type': 'Identifier',
                'name': 'args'
              },
              'property': {
                'type': 'Literal',
                'value': 0,
                'raw': '0'
              }
            };
          }
        });
      },
      MemberExpression: node => {
        const obj = node.object;
        if (obj.type !== 'Identifier') return;
        if (obj.name === 'args') return false;
        if (mode === 'html' && obj.name === '$event') {
          obj.name = 'args[0]';
          return false;
        }
        const varName = obj.name;
        const vmVar = this._vms.find(v => v.name === varName);
        const level = vmVar ? vmVar.level : 0;
        obj.name = `vm_${level}.${vmVar ? vmVar.reflect : varName}`;
        return false;
      },
      IfStatement: node => {
        if (node.consequent.type !== 'BlockStatement') {
          node.consequent = {
            type: 'BlockStatement',
            body: [node.consequent]
          };
        }
        if (!node.alternate) return;
        if (node.alternate.type !== 'IfStatement' && node.alternate.type !== 'BlockStatement') {
          node.alternate = {
            type: 'BlockStatement',
            body: [node.alternate]
          };
        }
      }
    });
    let code = escodegen.generate(tree, { indent: '' });
    code = code.substring(14, code.length - 1);
    return {
      code
    };
  }
  _parse_attrs(mode, tag, ctx, parentInfo) {
    const attrCtxs = ctx.htmlAttribute();
    if (!attrCtxs || attrCtxs.length === 0) return {
      constAttrs: [],
      argAttrs: [],
      listeners: [],
      vms: [],
      argPass: null,
      ref: null,
      argUse: null
    };
    const constAttrs = {};
    const argAttrs = {};
    const listeners = {};
    const vms = [];
    const pVms = this._vms;
    let argPass = null;
    let argUse = null;
    let ref = null;

    attrCtxs.forEach(attrCtx => {
      const attr_data = attrCtx.ATTR_NAME().getText().split(':').map(it => it.trim());
      if (attr_data.length > 2) throw new Error('bad attribute format.');

      let [a_category, a_name] = attr_data;
      if (attr_data.length === 1) {
        a_name = a_category;
        a_category = 'str';
      }
      if (a_category && KNOWN_ATTR_TYPES.indexOf(a_category.toLowerCase()) < 0) {
        throw new Error('unkown attribute type ' + a_category);
      }
      if (!/^[\w\d$_-]+$/.test(a_name)) {
        throw new Error('attribute name must match /^[\\w\\d$_-]+$/');
      }
      a_category = a_category.toLowerCase();

      if (a_category === 'ref') {
        if (!a_name) throw new Error('ref attribute require name.');
        if (ref) throw new Error('ref attribute can only be used once!');
        ref = a_name;
        return;
      }

      const atv = attrCtx.ATTR_VALUE();
      let aval = atv ? atv.getText().trim() : '';
      // extract from quote
      if (aval) aval = aval.substr(1, aval.length - 2).trim();

      if (a_category === 'vm') {
        if (mode === 'html') throw new Error('vm type atrribute can\'t be used on html element.');
        if (!aval) throw new Error('vm type attribute require reflect variable name.');
        if (!/^[\w\d$_]+$/.test(aval)) throw new Error('vm type attribute reflect vairable name must match /^[\\w\\d$_]+$/');
        if (pVms.find(v => v.name === aval) || vms.find(v => v.name === aval)) throw new Error('vm type attribute reflect varibale name has been declared: ' + aval);
        vms.push({ name: aval, reflect: a_name, level: pVms.length > 0 ? pVms[pVms.length - 1].level + 1 : 1 });
        return;
      }

      if (a_category === 'arg') {
        if (mode === 'html') throw new Error('arg type atrribute can\'t be used on html element.');
        if (a_name !== 'pass' && a_name !== 'use') throw new Error('arg type attribute only support name: "arg:pass" or "arg:use"');
        if (argPass || argUse) throw new Error('arg type attribute can only be used once!');
        if (parentInfo.sub === 'argument' || parentInfo.sub === 'parameter') {
          throw new Error('if parent component has arg type attribute, child component can\'t also have arg type attribue.');
        }
        if (a_name === 'pass') {
          if (parentInfo.type !== 'component') throw new Error('"arg:pass" attribute can only be used on root child of Component element.');
          argPass = aval;
        } else {
          argUse = aval;
        }
        return;
      }

      if (a_category === 'on') {
        if (!a_name) throw new Error('event name is required!');
        if (a_name in listeners) throw new Error('event name is dulplicated: ' + a_name);
        listeners[a_name] = this._parse_listener(aval, mode);
        return;
      }

      if (a_name in constAttrs || a_name in argAttrs) throw new Error('dulplicated attribute:', a_name);
      if (!aval) {
        if (a_category === 'expr') {
          throw new Error('Attribute with expression type must have value.');
        }
        constAttrs[a_name] = atv ? '' : true;
        return;
      }

      if (a_category === 'expr' || a_category === 'e') {
        // TODO: if expression is const，handle it as 'constAttrs'
        argAttrs[a_name] = this._parse_expr(aval, ctx);
        return;
      }

      if (aval.indexOf('$') < 0) {
        constAttrs[a_name] = aval;
        return;
      }

      const es = [];
      const paths = [];
      const addPath = p => {
        if (!paths.find(ep => ep.vm === p.vm && ep.n === p.n)) paths.push(p);
      };
      AttributeValueParser.parse(aval).forEach(it => {
        if (it.type === 'TEXT') {
          es.push(JSON.stringify(it.value));
        } else if (it.value) {
          const result = this._parse_expr(it.value, attrCtx);
          result.paths.forEach(addPath);
          es.push(`(${result.expr})`);
        }
      });

      argAttrs[a_name] = {
        expr: es.length > 1 ? '\'\' + ' + es.join(' + ') : es[0],
        paths
      };
    });

    function obj2arr(obj) {
      return Object.keys(obj).map(k => [k, obj[k]]);
    }


    if (argPass && argUse) throw new Error('arg:pass and arg:use attribute cannot be both used');

    const rtn = {
      constAttrs: obj2arr(constAttrs),
      argAttrs: obj2arr(argAttrs),
      listeners: obj2arr(listeners).map(lis => {
        lis[1].code = lis[1].code.replace(/(^[\s;]+)|([\s;]+$)/g, '').replace(/[\r\n]/g, ';').replace(/;+/g, ';');
        lis[1].code = lis[1].code.replace(/\{\s*;+/g, '{');
        return lis;
      }),
      vms,
      argPass,
      argUse,
      ref
    };

    if ((argPass || argUse) && (
      rtn.constAttrs.length > 0 || rtn.argAttrs.length > 0 || rtn.listeners.length > 0
      || rtn.vms.length > 0 || ref
    )) throw new Error('if a component has type attribute(ie. arg:pass or arg:use), it can\'t have any other attribute');

    return rtn;
  }
  _parse_html_ele(etag, ctx) {
    const result = this._parse_attrs('html', etag, ctx, this._parent);
    const elements = this._visit_child_nodes(ctx, result.vms, { type: 'html' });
    const setRefCode = result.ref ? this._replace_tpl(TPL.SET_REF_ELE, { NAME: result.ref }) : '';
    const pushEleCode = this._parent.type === 'component' ? this._replace_tpl(TPL.PUSH_ROOT_ELE) : '';

    const ce = `${result.constAttrs.length > 0 ? 'createElement' : 'createElementWithoutAttrs'}_${this._id}`;
    const arr = [`"${etag}"`];
    if (result.constAttrs.length > 0) {
      arr.push('{\n' + this._prependTab(result.constAttrs.map(at => `${at[0]}: ${JSON.stringify(at[1])}`).join(',\n')) + '\n}');
    }
    arr.push(this._join_elements(elements));
    let code;
    if (result.argAttrs.length > 0 || result.listeners.length > 0 || setRefCode || pushEleCode) {
      code = '(() => {\n' + this._prependTab(` 
const el = ${ce}(
${this._prependTab(arr.join(',\n'))}
);
${result.argAttrs.map((at, i) => {
    let setFn = null;

    if (at[0] in HTML_BOOL_IDL_ATTRS) {
      const attr = HTML_BOOL_IDL_ATTRS[at[0]];
      if (attr.tags === '*' || attr.tags.indexOf(etag) >= 0) {
        setFn = `() => el[JINGE_CONSTS_${this._id}.HTML_ATTR_${at[0]}] = !!(${at[1].expr})`;
      }
    } else if (at[0] in HTML_COMMON_IDL_ATTRS) {
      const attr = HTML_COMMON_IDL_ATTRS[at[0]];
      if (attr.tags === '*' || attr.tags.indexOf(etag) >= 0) {
        setFn = `() => el[JINGE_CONSTS_${this._id}.HTML_ATTR_${at[0]}] = ${at[1].expr}`;
      }
    }
    if (!setFn) {
      setFn = `() => setAttribute_${this._id}(el, "${at[0]}", ${at[1].expr})`;
    }
    return `const fn_${i} = ${setFn};
${at[1].paths.map(p => `${p.vm}[VM_ON_${this._id}](${p.n}, fn_${i}, component);
fn_${i}();`).join('\n')}`;
  }).join('\n')}
${result.listeners.map(lt => `addEvent_${this._id}(el, '${lt[0]}', function(...args) {${lt[1].code}})`).join('\n')}
${setRefCode}
${pushEleCode}
return el;`, true) + '\n})()';
    } else {
      code = `${ce}(\n${this._prependTab(arr.join(',\n'))}\n)`;
    }
    return {
      type: 'html',
      value: code
    };
  }
  _assert_arg_pass(elements, Component) {
    let found = 0;
    const args = {};
    elements.forEach(el => {
      if (el.type === 'component' && el.sub === 'argument') {
        if (found < 0) throw new Error(`children of <${Component}> must satisfy the requirement that all of them contain arg:pass attribute or all of them do not contain arg:pass attribute`);
        if (el.argPass in args) {
          throw new Error(`arg:pass name must be unique under <${Component}>, but found duplicate: ${el.argPass}`);
        }
        args[el.argPass] = true;
        found = 1;
      } else {
        if (found > 0) throw new Error(`children of <${Component}> must satisfy the requirement that all of them contain arg:pass attribute or all of them do not contain arg:pass attribute`);
        found = -1;
      }
    });
    return found > 0;
  }
  _parse_component_ele(tag, Component, ctx) {
    const result = this._parse_attrs('component', Component, ctx, this._parent);
    if (tag === 'argument' && !result.argPass) {
      throw new Error('<argument> component require "arg:pass" attribute.');
    }
    if (tag === 'parameter' && !result.argUse) {
      throw new Error('<parameter> component require "arg:use" attribute.');
    }
    let elements = this._visit_child_nodes(ctx, result.vms, {
      type: 'component',
      sub: result.argPass ? 'argument' : (result.argUse ? 'parameter' : 'normal'),
      vms: result.vms
    });
    const hasArg = this._assert_arg_pass(elements, tag);
    const setRefCode = result.ref ? this._replace_tpl(TPL.SET_REF_ELE, { NAME: result.ref }) : '';
    const vmLevel = result.vms.length > 0 ? result.vms[result.vms.length - 1].level : -1;
    if (result.argUse) {
      if (hasArg || result.vms.length > 0) throw new Error('impossible?!');
      return {
        type: 'component',
        sub: 'parameter',
        value: this._replace_tpl(TPL.PARAMETER, {
          ARG_USE: JSON.stringify(result.argUse),
          DEFAULT: elements.length > 0 ? ` || ${this._gen_render(elements, vmLevel)}` : ''
        })
      };
    }

    if (result.argPass) {
      if (elements.length === 0) {
        throw new Error(`<${tag}>: component with "arg:pass" attribute must have children`);
      }
      return {
        type: 'component',
        sub: 'argument',
        argPass: result.argPass,
        value: this._gen_render(elements, vmLevel)
      };
    }

    if (elements.length > 0) {
      if (!hasArg) {
        elements = [{
          type: 'component',
          sub: 'argument',
          argPass: 'default',
          value: this._gen_render(elements, vmLevel)
        }];
      }
    }

    const attrs = [];
    result.argAttrs.length > 0 && attrs.push(...result.argAttrs.map(at => `${at[0]}: null`));
    result.constAttrs.length > 0 && attrs.push(...result.constAttrs.map(at => `${at[0]}: ${JSON.stringify(at[1])}`));
    if (elements.length > 0) attrs.push(`[ARG_COMPONENTS_${this._id}]: {
${this._prependTab(elements.map(el => `[${el.argPass === 'default' ? `STR_DEFAULT_${this._id}` : `'${el.argPass}'`}]: ${el.value}`).join(',\n'))}
}`);
    const vmAttrs = `const attrs = wrapViewModel_${this._id}({
${this._prependTab(`[CONTEXT_${this._id}]: component[CONTEXT_${this._id}],`)}
${this._prependTab(attrs.join(',\n'), true)}
}, true);
${result.argAttrs.map((at, i) => `const fn_${i} = () => attrs.${at[0]} = ${at[0].startsWith('_') ? at[1].expr : `wrapViewModel_${this._id}(${at[1].expr})`};
${at[1].paths.map(p => `${p.vm}[VM_ON_${this._id}](${p.n}, fn_${i}, component);`).join('\n')}
fn_${i}();`).join('\n')}
`;
    return {
      type: 'component',
      sub: 'normal',
      value: '...(() => {\n' + this._prependTab(`
${vmAttrs}
const el = new ${Component}(attrs);
${result.listeners.map(lt => `el.on('${lt[0]}', function(...args) {${lt[1].code}})`).join('\n')}
${setRefCode}
${this._parent.type === 'component' ? this._replace_tpl(TPL.PUSH_ROOT_ELE) : this._replace_tpl(TPL.PUSH_COM_ELE)}
return assertRenderResults_${this._id}(el[RENDER_${this._id}](component));`, true) + '\n})()'
    };
  }
  
  _parse_expr(txt, ctx) {
    txt = txt.trim();
    /*
     * if expression startsWith '{', we treat it as ObjectExpression.
     * we wrap it into '()' to treat it as ObjectExpression.
     */
    if (txt[0] === '{') txt = '(' + txt + ')';
    let expr = acorn.Parser.parse(txt, {
      // ranges: true,
      locations: true,
    });
    if (expr.body.length > 1 || expr.body[0].type !== 'ExpressionStatement') {
      // console.log(ctx.start.line, this._baseLinePosition);
      this._throwParseError(ctx.start, 'expression only support single ExpressionStatement. see https://[todo].');
    }
    expr = expr.body[0].expression;

    const paths = [];
    const addPath = p => {
      if (!paths.find(ep => ep.vm === p.vm && ep.n === p.n)) paths.push(p);
    };
    this._walkAcorn(expr, {
      CallExpression: node => {
        /**
         * KNOWN ISSUE: in injected template, ctx.start.column + ctx.start.text.length may not be correct column position.
         */
        const pos = {line: (node.loc.start.line - 1) + ctx.start.line, column: ctx.start.column + ctx.start.text.length + node.loc.start.column};
        this._throwParseError(pos, `expression not support function call: '${txt.substring(node.start, node.end)}'. see https://[todo]`);
      },
      Identifier: node => {
        const varName = node.name;
        const vmVar = this._vms.find(v => v.name === varName);
        const level = vmVar ? vmVar.level : 0;
        node.name = `vm_${level}.${vmVar ? vmVar.reflect : varName}`;
        if (!varName.startsWith('_')) {
          addPath({
            vm: `vm_${level}`,
            n: JSON.stringify(vmVar ? vmVar.reflect : varName)
          });
        }
        return false;
      },
      MemberExpression: node => {
        let props = [];
        const hasComputed = visitMem(node, props);
        if (props.length < 2) throw new Error('impossible?!');
        const fn = props[0].node;
        const varName = fn.name;
        const vmVar = this._vms.find(v => v.name === varName);
        const level = vmVar ? vmVar.level : 0;
        fn.name = `vm_${level}.${vmVar ? vmVar.reflect : varName}`;
        props[0].v = vmVar ? vmVar.reflect : varName;
        const privateIdx = props.findIndex(p => p.v.startsWith('_'));
        if (privateIdx === 0) return false;
        if (privateIdx > 0) props = props.slice(0, privateIdx);
        addPath({
          vm: `vm_${level}`,
          n: JSON.stringify(
            hasComputed ? props.map(p => p.v) : props.map(p => p.v).join('.')
          )
        });
        return false;
      }
    });

    function visitMem(node, props, isObject = false) {
      if (node.type === 'Identifier') {
        props.unshift({ node, v: node.name });
        return false;
      }
      if (node.type === 'Literal') {
        if (isObject) throw new Error('current version does not support Literal type object in member expression');
        props.unshift({ node, v: node.value.toString() });
        return true;
      }
      if (node.type !== 'MemberExpression') {
        throw new Error('current version does not support computed member expression: ' + node.type);
      }

      return visitMem(node.property, props, false) || visitMem(node.object, props, true);
    }
    const dd = escodegen.generate(expr);
    return {
      expr: dd,
      paths
    };
  }
  _join_elements(elements) {
    return elements.map(el => el.value).join(',\n');
  }
  _gen_render(elements, vmLevel = -1) {
    const body = this._prependTab(`${vmLevel >= 0 ? `const vm_${vmLevel} = component;` : ''}
return [
${this._join_elements(elements)}
];`);
    return `function(component) {
${body}
}`;
  }
  _visit_child_nodes(ctx, vms, parent) {
    const cnodes = ctx.htmlNode();
    if (cnodes.length === 0) return [];
    this._enter(vms, parent);
    const elements = cnodes.map(n => this.visitHtmlNode(n)).filter(el => !!el);
    this._exit();
    return elements;
  }
  visitHtml(ctx) {
    const elements = super.visitHtml(ctx).filter(el => !!el);
    // console.log(elements);
    return {
      renderFn: this._gen_render(elements, 0),
      aliasImports: Object.keys(this._aliasImports).map(source => {
        return `import { ${this._aliasImports[source].map(c => `${c} as ${this._aliasLocalMap[source][c]}`).join(', ')} } from '${source}';`;
      }).join('\n'),
      imports: this._importOutputCodes.join('\n')
    };
  }
  visitHtmlNode(ctx) {
    const elements = super.visitHtmlNode(ctx).filter(el => !!el);
    if (elements.length === 0) return null;
    else if (elements.length === 1) return elements[0];
    else {
      throw new Error('unexpected?!');
    }
  }
  visitHtmlTextContent(ctx) {
    const eles = [];
    // const last = ctx.children.length - 1;
    ctx.children.forEach(cn => {
      let txt = cn.getText();
      if (cn.ruleIndex === TemplateParser.RULE_htmlText) {
        // const txt = cn.getText().replace(/`/g, '\\`');
        // if (i === 0) txt = txt.trimLeft();
        // if (i === last) txt = txt.trimRight();
        // if (!txt) return;
        if (!txt.trim()) return;
        txt = JSON.stringify(txt);
        eles.push(this._parent.type === 'html' ? txt : this._replace_tpl(TPL.TEXT_CONST, {
          VAL: txt
        }));
      } else {
        txt = txt.substring(2, txt.length - 1).trim(); // extract from '${}'
        if (!txt) return;
        const result = this._parse_expr(txt, cn);
        eles.push(this._replace_tpl(TPL.TEXT_EXPR, {
          PUSH_ELE: this._parent.type === 'component' ? this._replace_tpl(TPL.PUSH_ROOT_ELE) : '',
          EXPR: result.expr,
          WATCH: this._prependTab(result.paths.map(p => `${p.vm}[VM_ON_${this._id}](${p.n}, fn, component);`).join('\n'))
        }));
      }
      return txt;
    });
    if (eles.length > 0) {
      if (this._needHandleComment) {
        this._needHandleComment = false; // we only handle comment on topest
      }
      return {
        type: 'text',
        value: eles.join(',\n')
      };
    } else {
      return null;
    }
  }
  visitHtmlElement(ctx) {
    if (this._needHandleComment) {
      this._needHandleComment = false; // we only handle comment on topest
    }
    const etag = ctx.htmlStartTag().getText();
    const endT = ctx.htmlEndTag();
    if (endT && endT.getText() !== etag) {
      throw new Error(`close tag <${endT.getText()}> does not match open <${etag}>`);
    }
    if (/^[a-z\d-]+$/.test(etag)) {
      if (etag in this._alias) {
        const [c, source] = this._alias[etag];
        let arr = this._aliasImports[source];
        if (!arr) {
          arr = this._aliasImports[source] = [];
        }
        if (arr.indexOf(c) < 0) {
          arr.push(c);
        }
        return this._parse_component_ele(etag, this._aliasLocalMap[source][c], ctx);
      }

      if (HTMLTags.indexOf(etag) < 0) {
        console.warn(`warning: '${etag}' is not known html tag, do you forgot to config component alias?`);
      }
      return this._parse_html_ele(etag, ctx);
    }
    if (!(etag in this._imports)) {
      throw new Error(`Component '${etag}' not found. Forgot to import it on the top?`);
    }
    return this._parse_component_ele(etag, this._imports[etag], ctx);
  }
  visitHtmlComment(ctx) {
    if (!this._needHandleComment) return null; // we only handle comment on topest
    const comment = ctx.getText();
    // extract code from comment: <!-- -->
    const code = comment.substring(4, comment.length - 3);
    // import keyword not found. 
    if (!/(^|[\s;])import($|\s)/.test(code)) return null; 
    let tree;
    try {
      tree = acorn.Parser.parse(code, {
        sourceType: 'module'
      });
    } catch(ex) {
      console.error('Warning: keyword "import" is found in comment, but got error when tring to parse it as js code. see https://[todo]');
      console.error(' >', ex.message);
      console.error(' >', this._resourcePath);
      return;
    }
    tree.body = tree.body.filter(node => {
      if (node.type !== 'ImportDeclaration') return false;
      const specifiers = [];
      for (let i = 0; i < node.specifiers.length; i++) {
        const spec = node.specifiers[i];
        const local = spec.local.name;
        if (local in this._imports) {
          console.log(`Warning: dulpilcated imported local name '${local}' will be ignore. see https://[todo]`);
          console.log(' >', this._resourcePath);
          continue;
        } else {
          this._imports[local] = node.source.value === '.' ? local : `${local}_${this._tplId}`;
        }
        if (node.source.value === '.') {
          // skip import XX from '.', which means Component used is in same file.
          continue;
        }
        spec.local.name += `_${this._tplId}`;
        specifiers.push(spec);
      }
      if (specifiers.length > 0) {
        node.specifiers = specifiers;
        return true;
      } else {
        return false;
      }
    });
    if (tree.body.length === 0) return null;
    const output = escodegen.generate(tree, { indent: '' });
    // console.log(output);
    this._importOutputCodes.push(output);
    return null;
  }
}

module.exports = {
  TemplateVisitor
};
