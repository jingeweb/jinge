const escodegen = require('escodegen');
const path = require('path');
const crypto = require('crypto');
const acorn = require('acorn');
const acornWalk = require('acorn-walk');
const HTMLTags = require('html-tags');
const SVGTags = require('svg-tags');
const HTMLEntities = new (require('html-entities').AllHtmlEntities)();
const {
  i18nManager
} = require('../i18n');
const {
  sharedOptions
} = require('../options');
const {
  replaceTplStr,
  prependTab,
  attrN,
  isSimpleProp,
  getUniquePostfix
} = require('../util');
const {
  aliasManager
} = require('./alias');
const {
  parse
} = require('./helper');
const {
  TemplateParserVisitor
} = require('./parser/TemplateParserVisitor');
const {
  TemplateParser
} = require('./parser/TemplateParser');
const {
  AttributeValueParser
} = require('./AttributeValueParser');
const {
  HTML_BOOL_IDL_ATTRS,
  HTML_COMMON_IDL_ATTRS
} = require('./const');
const TPL = require('./tpl');

const KNOWN_ATTR_TYPES = [
  /* bellow is parameter related attribute types */
  /* s is just alias of str */
  'expr', 'e', 'str', 's',
  /* bellow is message/event related attribute type */
  'on',
  /* bellow is compiler related attribute types */
  'vm', 'vm-pass', 'vm-use',
  'slot-pass', 'slot-use',
  'ref',
  /* translate attribute */
  '_t'
];

function genCstylePid(pid, sid, underI18n) {
  if (!pid && !sid) return '';
  else if (pid && sid) return `compStyle: {...${pid}, [cstyId${underI18n ? ' || ""' : ''}]: ${underI18n ? 'cstyId || null' : '""'}},`;
  else if (pid) return `compStyle: ${pid} ? { ...${pid} } : null,`;
  else return `compStyle: {[cstyId${underI18n ? ' || ""' : ''}]: ${underI18n ? 'cstyId || null' : '""'}},`;
}

let cachedImportPostfix = '';

class TemplateVisitor extends TemplateParserVisitor {
  constructor(opts) {
    super();
    this._stack = [];
    this._vms = [];
    this._id = opts.rndId;
    this._source = opts.source;
    this._resourcePath = opts.resourcePath;
    this._webpackLoaderContext = opts.webpackLoaderContext;
    this._importPostfix = cachedImportPostfix || (cachedImportPostfix = '_' + crypto.createHmac('sha256', 'import-postfix').update(sharedOptions.symbolPostfix).digest('hex').substr(0, 12));
    this._baseLinePosition = opts.baseLinePosition || 1;
    this._isProdMode = sharedOptions.compress;
    this._imports = {};
    this._importOutputCodes = [];
    this._i18nRenderDeps = {
      codes: [],
      keys: new Map()
    };
    this._aliasImports = {};
    this._needHandleComment = true;
    this._cstyId = opts.componentStyleId;
    this._parent = {
      type: 'component', sub: 'root'
    };
  }

  _logParseError(tokenPosition, msg, type = 'Error') {
    let idx = -1;
    for (let i = 0; i < tokenPosition.line - 1; i++) {
      idx = this._source.indexOf('\n', idx + 1);
    }
    idx = idx + 1;
    const eidx = this._source.indexOf('\n', idx);
    this._webpackLoaderContext.emitError(new Error(`${type} occur at line ${tokenPosition.line + this._baseLinePosition - 1}, column ${tokenPosition.column}:
> ${this._source.substring(idx, eidx > idx ? eidx : this._source.length)}
> ${this._resourcePath}
> ${msg}`));
  }

  _throwParseError(tokenPosition, msg) {
    this._logParseError(tokenPosition, msg);
    throw new Error('parsing aborted as error occur.');
  }

  _replace_tpl(str, ctx) {
    ctx = ctx || {};
    ctx.POSTFIX = sharedOptions.symbolPostfix;
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
    return prependTab(str, replaceStartEndEmpty, 2);
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

  _parse_listener(str, mode, tag) {
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
          type: 'CallExpression',
          callee: exp.expression,
          arguments: [{
            type: 'SpreadElement',
            argument: {
              type: 'Identifier',
              name: 'args'
            }
          }]
        };
      }
    }

    const dealId = node => {
      const varName = node.name;
      const vmVar = this._vms.find(v => v.name === varName);
      const level = vmVar ? vmVar.level : 0;
      node.name = `vm_${level}.${vmVar ? vmVar.reflect : varName}`;
    };
    this._walkAcorn(block, {
      Identifier: node => {
        if (node.name === 'args') return false;
        if (mode === 'html' && node.name === '$event') {
          node.name = 'args[0]';
          return false;
        }
        dealId(node);
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
              type: 'MemberExpression',
              computed: true,
              object: {
                type: 'Identifier',
                name: 'args'
              },
              property: {
                type: 'Literal',
                value: 0,
                raw: '0'
              }
            };
          }
        });
      },
      // MemberExpression: node => {
      //   const obj = node.object;
      //   if (obj.type !== 'Identifier') return;
      //   if (obj.name === 'args') return false;
      //   if (mode === 'html' && obj.name === '$event') {
      //     obj.name = 'args[0]';
      //     return false;
      //   }
      //   dealId(obj);
      //   return false;
      // },
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
    let code = escodegen.generate(tree, {
      indent: ''
    });
    code = code.substring(14, code.length - 1);
    return {
      code,
      tag
    };
  }

  _parse_attr_value(aval) {
    const es = [];
    let moreThanOne = false;
    AttributeValueParser.parse(aval).forEach(it => {
      if (it.type === 'TEXT') {
        es.push(JSON.stringify(it.value));
      } else if (it.value) {
        es.push(moreThanOne ? `(${it.value})` : it.value);
      }
      moreThanOne = true;
    });
    return es.length > 0 ? es.join(' + ') : es[0];
  }

  _parse_attrs(mode, tag, ctx, parentInfo) {
    const attrCtxs = ctx.htmlAttribute();
    if (!attrCtxs || attrCtxs.length === 0) {
      return {
        constAttrs: [],
        argAttrs: [],
        translateAttrs: [],
        listeners: [],
        vms: [],
        vmPass: [],
        argPass: null,
        ref: null,
        argUse: mode !== 'html' && tag === '_slot' ? {
          component: null,
          fn: 'default'
        } : null
      };
    }
    const constAttrs = {};
    const translateAttrs = {};
    const argAttrs = {};
    const listeners = {};
    const vms = [];
    const vmPass = [];
    const pVms = this._vms;
    let argPass = null;
    let argUse = null;
    let ref = null;

    attrCtxs.forEach(attrCtx => {
      const attr_data = attrCtx.ATTR_NAME().getText().split(':').map(it => it.trim());
      if (attr_data.length > 2) throw new Error('bad attribute format.');

      let [a_category, a_name] = attr_data;
      let a_tag = null;
      if (attr_data.length === 1) {
        a_name = a_category;
        a_category = 'str';
      }
      if (a_category.startsWith('slot-use|')) {
        a_tag = a_category.substring(9);
        a_category = 'slot-use';
      }
      if (a_category.startsWith('on|')) {
        a_tag = {};
        a_category.substring(3).split(',').forEach(t => {
          a_tag[t.trim()] = true;
        });
        a_category = 'on';
      }

      if (a_category && KNOWN_ATTR_TYPES.indexOf(a_category.toLowerCase()) < 0) {
        this._throwParseError(attrCtx.start, 'unkown attribute type ' + a_category);
      }
      if (!/^[\w\d$_-][\w\d$_.|-]*$/.test(a_name)) {
        this._throwParseError(attrCtx.start, 'attribute name must match /^[\\w\\d$_-][\\w\\d$_.|-]*$/');
      }
      a_category = a_category.toLowerCase();

      if (a_category === 'ref') {
        if (!a_name) this._throwParseError(attrCtx.start, 'ref attribute require name.');
        if (ref) this._throwParseError(attrCtx.start, 'ref attribute can only be used once!');
        ref = a_name;
        return;
      }

      if (a_category === 'vm') a_category = 'vm-use';
      else if (a_category === 's') a_category = 'str';
      else if (a_category === 'e') a_category = 'expr';

      const atv = attrCtx.ATTR_VALUE();
      let aval = atv ? atv.getText().trim() : '';
      // extract from quote
      if (aval) aval = aval.substr(1, aval.length - 2).trim();

      if (a_category === 'vm-use') {
        if (!a_name) this._throwParseError(attrCtx.start, 'vm-use type attribute require reflect variable name.');
        if (!aval) aval = a_name;
        if (!/^[\w\d$_]+$/.test(aval)) this._throwParseError(attrCtx.start, 'vm-use type attribute value must match /^[\\w\\d$_]+$/, but got: ' + aval);
        if (!/^[\w\d$_]+$/.test(a_name)) this._throwParseError(attrCtx.start, 'vm-use type attribute reflect vairable name must match /^[\\w\\d$_]+$/, but got: ' + a_name);
        if (vms.find(v => v.name === aval)) this._throwParseError(attrCtx.start, 'vm-use type attribute name dulipcated: ' + a_name);
        if (pVms.find(v => v.name === aval)) this._throwParseError(attrCtx.start, 'vm-use attribute reflect vairiable name"' + a_name + '" has been declared in parent context.');
        vms.push({
          name: aval, reflect: a_name, level: pVms.length > 0 ? pVms[pVms.length - 1].level + 1 : 1
        });
        return;
      }

      if (a_category === 'vm-pass') {
        if (!a_name) this._throwParseError(attrCtx.start, 'vm-pass type attribute require reflect variable name.');
        if (!aval) aval = a_name;
        if (mode === 'html') this._throwParseError(attrCtx.start, 'vm-pass attribute can\'t be used on html element');
        if (!/^[\w\d$_]+$/.test(a_name)) this._throwParseError(attrCtx.start, 'vm-pass type attribute reflect vairable name must match /^[\\w\\d$_]+$/');
        if (vmPass.find(v => v.name === a_name)) this._throwParseError(attrCtx.start, 'vm-pass type attribute name dulipcated: ' + a_name);
        vmPass.push({
          name: a_name, expr: aval
        });
        return;
      }

      if (a_category === 'slot-pass') {
        if (argPass) this._throwParseError(attrCtx.start, 'slot-pass: attribute can only be used once!');
        if (parentInfo.sub === 'argument') {
          this._throwParseError(attrCtx.start, 'if parent component has slot-pass: or vm-use: attribute, child component can\'t also have slot-pass: attribue. Try to put component under <_slot>.');
        }
        if (parentInfo.type !== 'component') {
          this._throwParseError(attrCtx.start, 'slot-pass: attribute can only be used as root child of Component element.');
        }
        argPass = a_name;
        return;
      }

      if (a_category === 'slot-use') {
        if (argUse) {
          this._throwParseError(attrCtx.start, 'slot-use: attribute can only be used once!');
        }
        if (a_tag) {
          const ns = a_tag.split('.');
          const vmVar = this._vms.find(v => v.name === ns[0]);
          const level = vmVar ? vmVar.level : 0;
          ns[0] = `vm_${level}.${vmVar ? vmVar.reflect : ns[0]}`;
          a_tag = ns.join('.');
        }
        argUse = {
          component: a_tag,
          fn: a_name
        };
        return;
      }

      if (a_category === 'on') {
        if (!a_name) {
          this._throwParseError(attrCtx.start, 'event name is required!');
        }
        if (a_name in listeners) {
          this._throwParseError(attrCtx.start, 'event name is dulplicated: ' + a_name);
        }
        listeners[a_name] = [aval, mode, a_tag];
        return;
      }

      if (a_name in translateAttrs || a_name in constAttrs || a_name in argAttrs) {
        this._throwParseError(attrCtx.start, 'dulplicated attribute: ' + a_name);
      }
      if (!aval) {
        if (a_category === '_t') {
          this._throwParseError(attrCtx.start, 'attribute with _t: type require non-empty value');
        }
        if (a_category === 'expr') {
          this._throwParseError(attrCtx.start, 'Attribute with expression type must have value.');
        }
        constAttrs[a_name] = atv ? '' : true;
        return;
      }

      if (a_category === '_t') {
        if (!a_name || !aval) this._throwParseError(attrCtx.start, '_t: type attribute require name and value.');
        if (i18nManager.written) {
          /**
           * 如果多语言脚本资源已经处理过了（i18nManager.written === true），说明是在
           *   启用了 watch 的研发模式下，文件发生变化后重新编译，这种情况下，由于多方面的复杂
           *   问题不好解决，暂时先简化为不做多语言的处理。
           */
          a_category = 'str';
        } else {
          translateAttrs[a_name] = {
            type: aval.indexOf('${') >= 0 ? 'expr' : 'const',
            value: aval,
            ctx: {
              start: ctx.start
            }
          };
          return;
        }
      }

      if (a_category === 'expr') {
        argAttrs[a_name] = aval;
        return;
      }

      if (aval.indexOf('${') < 0) {
        constAttrs[a_name] = aval;
        return;
      }

      argAttrs[a_name] = this._parse_attr_value(aval);
    });

    function obj2arr(obj) {
      return Object.keys(obj).map(k => [k, obj[k]]);
    }

    /*
     * The logic is so complex that I have to write
     * Chinese comment to keep myself not forget it.
     */

    /**
     *
     * # slot-pass:, arg-use:, vm-pass:, vm-use:
     *
     * ## 基本说明
     *
     * #### slot-pass:
     *
     * 该属性指定要将外部元素传递到组件的内部渲染中。比如：
     *
     * ````html
     * <SomeComponent>
     * <_slot slot-pass:a>
     *  <span>hello</span>
     * </_slot>
     * </SomeComponent>
     * ````
     *
     * 以上代码会将 <_slot> 节点内的所有内容，按 key="a" 传递给
     * SomeComponent 组件。SomeComponent 组件在渲染时，可获取到该外部传递进
     * 来的元素。
     *
     * 对于 html 元素，slot-pass 属性本质上是给它包裹了一个父组件，比如：
     *   `<span slot-pass:a>hello</span>` 等价于：
     *   `<_slot slot-pass:a><span>hello</span></_slot>`，
     *
     * 对于 Component 元素，slot-pass 属性会让编译器忽略该组件的任何性质（或者理解成，
     *   任何有 slot-pass 属性的组件都会被替换成 <_slot> 空组件）。
     *
     * 对任何组件元素来说，如果它没有任何根子节点包含 slot-pass 属性，则编译器会
     *   默认将所有根子节点包裹在 <_slot slot-pass:default> 里。比如：
     *   `<SomeComponent><span>hello</span>Good<span>world</span></SomeComponent>`
     *   等价于：
     *   ````html
     *   <SomeComponent>
     *   <_slot slot-pass:default>
     *     <span>hello</span>Good<span>world</span>
     *   </_slot>
     *   </SomeComponent>
     *   ````
     *
     * #### vm-use:
     *
     * vm-use: 可以简化写成 vm: 。
     *
     * 只有 slot-pass: 属性存在时，才能使用 vm-use: 属性。vm-use: 用于指定要通过 slot-pass: 传递到组件内部去的
     * 外部元素，在组件内部被渲染时，可以使用哪些组件内部提供的渲染参数；因此脱离 slot-pass: 属性，vm-use: 属性没有意义。
     *
     * 但为了代码的简介性，当 Component 元素没有根子节点有 slot-pass: 属性（即，它的所有根子节点
     * 被当作默认的 <_slot slot-pass:default>）时，
     * 这个组件`可以只有 vm-use: 而没有 slot-pass: 属性`。
     * 这种情况属于语法糖，本质上等价于在其默认的 <_slot slot-pass:default> 上添加了这些 vm-use:。比如：
     * `<SomeComponent vm-use:a="b"><span>${b}</span></SomeComponent>` 等价于：
     * `<SomeComponent><_slot slot-pass:default vm-use:a="b"><span>${b}</span></_slot></SomeComponent>`
     *
     * 一个典型的实际例子是 <for> 循环。<for> 是 ForComponent 组件的别名，
     * 该组件自身的渲染逻辑，是循环渲染通过 slot-pass:default 传递进来的外部元素。
     * 结合上文，常见的代码 `<for e:loop="list" vm:each="item">${item}</for>` 等价于：
     * ````html
     * <!-- import {ForComponent} from 'jinge' -->
     * <ForComponent e:loop="list">
     * <_slot slot-pass:default vm-use:each="item">${item}</_slot>
     * </ForComponent>
     * ````
     *
     * 其中，vm 是 vm-use 的简化写法。
     *
     * #### arg-use:
     *
     * 指定该组件在自己的内部渲染中，使用哪些通过 slot-pass: 传递进来的外部元素。
     * 以上文 slot-pass: 属性下的代码为例， SomeComponent 组件的模板里，
     * 可以这样使用：
     *
     * ````html
     * <!-- SomeComponent.html -->
     * <parameter arg-use:a />
     * <parameter arg-use:b>
     *   <span>default text</span>
     * </parameter>
     * ````
     *
     * 通过跟 slot-pass: 一致的 key="a"，实现了 arg-use: 和 slot-pass: 的关联，
     * 将外部的元素渲染到自身内部。如果 arg-use: 属性的组件，还有子节点，则这些子节点
     * 代表外部没有传递对应 key 的外部元素时，要默认渲染的元素。
     *
     * 以上代码最终渲染的结果是 `<span>hello</span><span>default text</span>`。
     *
     * 对于 html 元素，arg-use: 属性本质上是给它包裹了一个父组件，比如：
     *   `<span arg-use:a>default</span>` 等价于：
     *   `<parameter arg-use:a><span>default</span></parameter>`，
     *
     * 对于 Component 元素，arg-use: 属性会让编译器忽略该组件的任何性质（或者理解成，
     *   任何有 arg-use: 属性的组件都会被替换成 <parameter> 空组件）。
     *
     * #### vm-pass:
     *
     * 只有 arg-use: 属性存在时，才能使用 vm-pass: 属性。vm-pass: 用于指定要向外部通过 slot-pass: 传递进来的
     * 外部元素传递过去哪些渲染参数，因此脱离 arg-use: 属性，vm-pass: 属性没有意义。
     *
     * 比如常见的 <for> 循环，即 ForComponent 组件，会向外部元素传递 'each' 和 'index' 两
     * 个渲染参数。但对 ForComponent 组件，这种传递是直接在 js 逻辑里写的，而没有
     * 直接通过 vm-pass: 属性（因为 ForComponent 组件自身没有模板）。
     *
     * 如下是在模板中传递渲染参数的示例：
     *
     * ````html
     * <!-- SomeComponent.html -->
     * <div><parameter arg-use:a vm-pass:xx="name + '_oo' ">hello, ${name}</parameter></div>
     * ````
     *
     * 以上代码会向外部组件传递名称为 xx 的渲染参数，这个参数的值是 `name + 'oo'` 这个表达式
     * 的结果。表达式里的 name 是该组件的 property。当 name 发生变化时，向外传递的 xx 也会更新并
     * 通知外部组件重新渲染。
     *
     * 以下是使用 SomeComponent 组件时的用法：
     *
     * ````html
     * <!-- app.html -->
     * <SomeComponent>
     *   <p slot-pass:a vm-use:xx="yy">override ${yy}</p>
     * </SomeComponent>
     * ````
     *
     * 假设 SomeComponent 的 name 是 'jinge'，则 app.html 最终渲染出来是
     * `<p>override jinge_oo</p>`
     *
     * ## 补充说明
     *
     * #### slot-pass: 必须用于 Component 元素的子元素。
     *
     * #### slot-pass: 和 arg-use: 不能同时使用。
     *
     * slot-pass: 和 arg-use: 同时存在，可以设计来没有歧义，
     *   比如：`<span slot-pass:a arg-use:c>hello</span>` 可以设计为等价于：
     *
     * 可以等价于：
     *
     * ````html
     * <_slot slot-pass:a>
     *   <_slot slot-use:b>
     *     <span>hello</span>
     *   </_slot>
     * </_slot>
     * ````
     *
     * 但这种等价有一定的隐晦性。由于这种使用场景很少，
     * 因此不提供这个场景的简化写法。
     *
     */

    // slot-pass: 属性和 arg-use: 属性不能同时存在，详见上面的注释。
    if (argPass && argUse) {
      this._throwParseError(ctx.start, 'slot-pass: and slot-use: attribute can\' be both used on same element');
    }

    // html 元素上的必须有 slot-pass: 属性，才能有 vm-use: 属性
    // component 元素可以只有 vm-use: 属性，但需要满足上面注释里详细描述的条件，这个条件的检测在之后的代码逻辑里。
    if (vms.length > 0 && !(argPass) && mode === 'html') {
      this._throwParseError(ctx.start, 'vm-use: attribute require slot-pass: attribute on html element. see https://[todo]');
    }

    // vm-pass: 属性必须用在有 arg-use: 属性的元素上。
    if (vmPass.length > 0 && !argUse) {
      this._throwParseError(ctx.start, 'vm-pass: attribute require slot-use: attribute');
    }
    // vm-use: 属性不能用在有 arg-use: 属性的元素上。
    if (argUse && vms.length > 0) {
      this._throwParseError(ctx.start, 'vm-use: attribute can\'t be used with slot-use: attribute');
    }
    if (argPass && (this._parent.type !== 'component' || this._parent.sub === 'root')) {
      this._throwParseError(ctx.start, 'slot-pass: attribute can only be used on Component element\'s root child.');
    }
    //
    if (tag === '_slot' && !argPass && !argUse) {
      this._throwParseError(ctx.start, '<_slot> component require "slot-pass:" or "slot-use:" attribute.');
    }
    /**
     * 如果元素上有 slot-pass: 和 vm-use: ，则该元素等价于被包裹在
     * slot-pass: 和 vm-use: 的 <_slot> 组件里。这种情况下，html 元素上
     * 的其它表达式值属性，是可以使用该 vm-use: 引入的渲染参数的。因此，要将这些参数
     * 先添加到参数列表里，再进行 _parse_expr 或 _parse_listener，
     * parse 结束后，再恢复参数列表。比如如下代码：
     *
     * ````html
     * <SomeComponent>
     *   <p slot-pass:a vm-use:xx="yy" class="c1 ${yy}">override ${yy}</p>
     *   <AnotherComponent slot:b vm:xx="yy"/>
     * </SomeComponent>
     * ````
     *
     * 等价于：
     *
     * ````html
     * <SomeComponent>
     * <_slot slot-pass:a vm-use:xx="yy">
     *   <p class="c1 ${yy}">override ${yy}</p>
     * </_slot>
     * <_slot slot-pass:b vm-use:xx="yy">
     *   <AnotherComponent/>
     * </_slot>
     * </SomeComponent>
     * ````
     *
     * 其中的，`class="c1 ${yy}"` 使用了 `vm-use:xx="yy"` 引入的渲染参数。
     *
     */
    if (tag !== '_slot' && vms.length > 0) {
      this._vms = pVms.slice().concat(vms);
    }

    const rtn = {
      constAttrs: obj2arr(constAttrs),
      argAttrs: obj2arr(argAttrs).map(at => {
        const e = this._parse_expr(at[1], ctx).join('\n');
        at[1] = e;
        return at;
      }),
      translateAttrs: obj2arr(translateAttrs),
      listeners: obj2arr(listeners).map(lis => {
        const l = this._parse_listener(...lis[1]);
        l.code = l.code.replace(/(^[\s;]+)|([\s;]+$)/g, '')
          .replace(/[\r\n]/g, ';').replace(/;+/g, ';')
          .replace(/\{\s*;+/g, '{');
        lis[1] = l;
        return lis;
      }),
      vms,
      vmPass: vmPass.map(vp => {
        vp.expr = this._parse_expr(vp.expr, ctx);
        return vp;
      }),
      argPass,
      argUse,
      ref
    };
    if (tag !== '_slot' && vms.length > 0) {
      this._vms = pVms;
    }

    if (tag === '_slot' && (
      rtn.ref || rtn.constAttrs.length > 0 ||
      rtn.argAttrs.length > 0 ||
      rtn.listeners.length > 0
    )) {
      this._throwParseError(ctx.start, '<_slot> component can only have slot-pass: or slot-use: attribute');
    }
    return rtn;
  }

  _parse_html_ele(etag, ctx) {
    const result = this._parse_attrs('html', etag, ctx, this._parent);
    const elements = this._visit_child_nodes(ctx, result.vms, {
      type: 'html', isSVG: this._parent.isSVG || etag === 'svg'
    });
    const setRefCode = result.ref ? this._replace_tpl(TPL.SET_REF_ELE, {
      NAME: result.ref
    }) : '';
    const pushEleCode = this._parent.type === 'component' ? this._replace_tpl(TPL.PUSH_ROOT_ELE) : '';

    /**
     * 在某个组件（假设为 A 组件）的模板文件（假设为 a.html）里，任意一个 html 元素（假设为 x 元素）只会有以下四种情况：
     *
     * 1：x 是模板文件里的根节点，或某个 html 元素的根子节点。x 没有 slot-use: 或 slot-pass: 类型的属性。例如：
     *
     * ````html
     * <!-- a.html -->
     * <x/> <!-- 模板文件的根节点 -->
     * <div><x/></div> <!-- 某个 html 元素的根子节点- -->
     * <B><span><x/></span></B> <!-- 某个 html 元素的根子节点 -->
     * ````
     *
     * 这种情况下， x 会被添加 A 组件的 component style。同时，如果 x 是 a.html 文件的根子节点，还会继承 A 组件继承下来的 component style。
     *
     * 2：x 是 <_slot slot-use:? /> 的根子节点，或等价的情况， x 有 slot-use: 类型的属性。例如：
     *
     * ````html
     * <!-- a.html -->
     * <_slot slot-use:default><x/></_slot>
     * <div><x slot-use:default/></div>
     * ````
     *
     * 这种情况下，x 会被添加 A 组件的 component style。如果 <_slot> 是 a.html 的根子节点，则 x 需要继承  <_slot> 继承的 component style，而 <_slot> 是根子节点会继承  A，因此 x 最终实际继承 A 组件继承的 component style。
     * 为了简化代码逻辑，实际的代码逻辑，不论 _slot 是否是根子节点 ，x 始终继承 <_slot/> 继承的 component style。
     *
     * 3：x 是 <_slot slot-pass:/> 的根子节点，或等价的，x 有 slot-pass: 类型的属性。例如：
     *
     * ````html
     * <!-- a.html -->
     * <B><_slot slot-pass:default><x/></_slot></B>
     * <div><B><x slot-pass:default/><x/></B></div>
     * ````
     *
     * 这种情况下，x 元素实际会被作为 slot 传递给另一个组件（假设为 B 组件）。因此，x 除了会被添加 A 组件的 component style 外，还需要继承 B 组件的 component style，但不需要继承 A 组件继承的 component style。（有个特例是，如果 B 组件在 a.html 模板里是根子节点，则它会继承 A 组件的 component style，这种情况下 x 最终也会继承下来 A 的 component style）。
     *
     * 4：x 是另一个组件（假设为 B 组件）的根子节点，或 x 是多语言 <_t> 元素的根子节点。例如：
     *
     * ````html
     * <!-- a.html -->
     * <B><x/><span>hello</span></B>
     * <_t><x/></_t>
     * ````
     *
     * 这种情况下，本质等价于：
     *
     * ````html
     * <!-- a.html -->
     * <B><_slot slot-pass:default><x/><span>hello</span></_slot></B>
     * <I18nComponent><_slot slot-pass:default><x/></_slot></I18nComponent>
     * ````
     *
     * 因此，只需要按上述第 3 点的情况处理 component style 即可。
     * 
     */
    // 综合上述逻辑，只要 html 元素上有 slot-pass: 类型的属性，或者 html 元素是
    // component（包括 _slot 和组件元素） 的根子节点，都需要继承上下文父元素的 component style。
    const needAddParentStyId = result.argPass || this._parent.type === 'component';
    /**
     * 如果当前模板有 component style，则需要将该 style 添加到 html 元素上。
     * 但需要注意，在多语言环境下，不同的模板文件可能复用局部的 <_t> 代码。比如：
     * 
     * ````html
     * <!-- A 组件： a.html -->
     * <_t><p>Hello</_t>
     * ````
     * 
     * 和：
     * 
     * ````html
     * <!-- B 组件： b.html -->
     * <_t><p>Hello</_t>
     * ````
     * 
     * 这两个组件，会复用 <p>Hello</p> 这个多语言资源，这个元素的渲染代码实际会被
     * 抽取到多语言资源包文件里，这种情况下，是无法在编译的时候就知道 p 元素是否需要
     * 添加模板的 component style 以及该添加哪个模板（a.html 还是 b.html）的 component style。
     * 
     * 因此在多语言的情况下，编译时生成的代码始终添加 component style，但实际运行时
     * 判断 component style id 是否存在。
     */
    const needTplStyId = this._cstyId || this._underMode_T;

    const ceFn = `create${this._parent.isSVG || etag === 'svg' ? 'SVG' : ''}Element${result.constAttrs.length > 0 || needTplStyId || needAddParentStyId ? '' : 'WithoutAttrs'}`;
    const ce = `${ceFn}${sharedOptions.symbolPostfix}`;
    const arr = [`"${etag}"`];
    if (result.constAttrs.length > 0 || needTplStyId) {
      const attrsArr = result.constAttrs.map(at => `  ${attrN(at[0])}: ${JSON.stringify(at[1])}`);
      if (needTplStyId) {
        if (this._underMode_T) {
          attrsArr.push(`[cstyId || ""]: cstyId ? "" : null`);
        } else {
          attrsArr.push(`[cstyId]: ""`);
        }
      }
      const attrsCode = `{\n${attrsArr.join(',\n')}\n}`;
      if (needAddParentStyId) {
        arr.push(`Object.assign(${attrsCode}, component[__${sharedOptions.symbolPostfix}].compStyle)`);
      } else {
        arr.push(attrsCode);
      }
    } else if (needAddParentStyId) {
      arr.push(`component[__${sharedOptions.symbolPostfix}].compStyle`);
    }
    arr.push(this._join_elements(elements));
    let code;
    if (result.translateAttrs.length > 0 || result.argAttrs.length > 0 || result.listeners.length > 0 || setRefCode || pushEleCode) {
      code = '(() => {\n' + this._prependTab(` 
const el = ${ce}(
${this._prependTab(arr.join(',\n'))}
);
${result.argAttrs.map((at, i) => {
    if (at[0] in HTML_BOOL_IDL_ATTRS) {
      const attr = HTML_BOOL_IDL_ATTRS[at[0]];
      if (attr.tags === '*' || attr.tags.indexOf(etag) >= 0) {
        return this._replace_tpl(at[1], {
          REL_COM: `component[$$${sharedOptions.symbolPostfix}]`,
          ROOT_INDEX: i.toString(),
          RENDER_START: `el.${at[0]} = !!(`,
          RENDER_END: ');'
        });
      }
    } else if (at[0] in HTML_COMMON_IDL_ATTRS) {
      const attr = HTML_COMMON_IDL_ATTRS[at[0]];
      if (attr.tags === '*' || attr.tags.indexOf(etag) >= 0) {
        return this._replace_tpl(at[1], {
          REL_COM: `component[$$${sharedOptions.symbolPostfix}]`,
          ROOT_INDEX: i.toString(),
          RENDER_START: `el.${at[0]} = `,
          RENDER_END: ';'
        });
      }
    }
    return this._replace_tpl(at[1], {
      REL_COM: `component[$$${sharedOptions.symbolPostfix}]`,
      ROOT_INDEX: i.toString(),
      RENDER_START: `setAttribute$POSTFIX$(el, "${at[0]}", `,
      RENDER_END: ');'
    });
  }).join('\n')}
${result.translateAttrs.map((at, i) => {
    return this._parse_i18n_attr(at, result.argAttrs.length + i, true);
  }).join('\n')}
${result.listeners.map(lt => {
    return `addEvent${sharedOptions.symbolPostfix}(el, '${lt[0]}', function(...args) {${lt[1].code}${lt[1].tag && lt[1].tag.stop ? ';args[0].stopPropagation()' : ''}${lt[1].tag && lt[1].tag.prevent ? ';args[0].preventDefault()' : ''}}${lt[1].tag ? `, ${JSON.stringify(lt[1].tag)}` : ''})`;
  }).join('\n')}
${setRefCode}
${pushEleCode}
return el;`, true) + '\n})()';
    } else {
      code = `${ce}(\n${this._prependTab(arr.join(',\n'))}\n)`;
    }

    const vmLevel = result.vms.length > 0 ? result.vms[result.vms.length - 1].level : -1;
    const rtnEl = {
      type: 'html', value: code
    };

    if (result.argUse) {
      return this._parse_arg_use_parameter(
        [rtnEl], result.argUse, result.vmPass, vmLevel
      );
    }
    if (result.argPass) {
      return {
        type: 'component',
        sub: 'argument',
        argPass: result.argPass,
        value: this._gen_render([rtnEl], vmLevel)
      };
    }
    return rtnEl;
  }

  _parse_i18n_attr(at, idx, isDOM) {
    const aname = at[0];
    at = at[1];
    if (at.type === 'const') {
      const key = i18nManager.registerToDict(at.value, this._resourcePath);
      return this._replace_tpl(isDOM ? TPL.ATTR_I18N_DOM_CONST : TPL.ATTR_I18N_COMP_CONST_ON, {
        ROOT_INDEX: idx.toString(),
        NAME: aname,
        I18N_KEY: JSON.stringify(key)
      });
    }

    const vmsArgs = ['vm_0', ...this._vms.map((n, i) => `vm_${i + 1}`)].join(', ');
    const registerI18N = (code) => {
      [...code.matchAll(new RegExp(`[\\w\\d$_]+${sharedOptions.symbolPostfix}`, 'g'))].forEach(m => {
        if (this._i18nRenderDeps.keys.has(m[0])) return;
        this._i18nRenderDeps.keys.set(m[0], true);
        const idx = i18nManager.registerRenderDep(m[0]);
        if (idx >= 0) {
          this._i18nRenderDeps.codes.push(`i18n${sharedOptions.symbolPostfix}.__regDep(${idx}, ${m[0]});`);
        }
      });
    };
    const i18nKey = i18nManager.registerToAttr(at.value, this._resourcePath, (locale, text) => {
      const expr = this._parse_attr_value(text || at.value);
      let code;
      try {
        code = this._parse_expr(expr, at.ctx).join('\n');
      } catch (ex) {
        if (locale !== i18nManager.defaultLocale.name) {
          this._webpackLoaderContext.emitError(new Error(`Parse i18n expression failed, locale: ${locale}, expression: ${text}`));
        }
        throw ex;
      }
      code = this._replace_tpl(code, {
        ROOT_INDEX: '',
        RENDER_START: 'const __attrV = ',
        RENDER_END: `;\n      isDOM ? setAttribute${sharedOptions.symbolPostfix}(target, attrName, __attrV) : target[attrName] = __attrV;`,
        REL_COM: `component[$$${sharedOptions.symbolPostfix}]`
      });
      registerI18N(code);
      return `function(target, attrName, isDOM, component, ${vmsArgs}) {\n${prependTab(code, true, 4)}\n  }`;
    }, code => {
      registerI18N(code);
    });

    return this._replace_tpl(isDOM ? TPL.ATTR_I18N_DOM_EXPR : TPL.ATTR_I18N_COMP_EXPR_ON, {
      ROOT_INDEX: idx.toString(),
      NAME: aname,
      I18N_KEY: JSON.stringify(i18nKey),
      VMS: vmsArgs
    });
  }

  _parse_arg_use_parameter(elements, argUse, vmPass, vmLevel) {
    let vmPassInitCode = '';
    let vmPassSetCode = '';
    let vmPassWatchCode = '';
    const vmPassParamCode = [];
    if (vmPass.length > 0) {
      vmPass.forEach((vp, i) => {
        vmPassInitCode += `${vp.name}: null, `;
        vmPassSetCode += this._replace_tpl(vp.expr.slice(0, 3).join('\n'), {
          ROOT_INDEX: i.toString(),
          RENDER_START: `attrs.${vp.name} = `,
          RENDER_END: ';',
          REL_COM: `el[$$${sharedOptions.symbolPostfix}]`
        });
        vmPassWatchCode += this._replace_tpl(vp.expr.slice(3).join('\n'), {
          ROOT_INDEX: i.toString(),
          REL_COM: `el[$$${sharedOptions.symbolPostfix}]`
        });
        vmPassParamCode.push(vp.name);
      });
    }
    return {
      type: 'component',
      sub: 'parameter',
      value: this._replace_tpl(TPL.PARAMETER, {
        VM_RENDERER: argUse.component ? argUse.component : 'vm_0',
        VM_DEBUG_NAME: !this._isProdMode ? `debugName: "attrs_of_<parameter>",` : '',
        VM_PASS_INIT: vmPassInitCode,
        VM_PASS_SET: this._prependTab(vmPassSetCode),
        VM_PASS_WATCH: this._prependTab(vmPassWatchCode),
        VM_PASS_PARAM: JSON.stringify(vmPassParamCode),
        PUSH_ELE: this._prependTab(this._replace_tpl(this._parent.type === 'component' ? TPL.PUSH_ROOT_ELE : TPL.PUSH_COM_ELE)),
        ARG_USE: argUse.fn,
        CSTYLE_PID: genCstylePid(this._parent.type === 'component' ? `component[__${sharedOptions.symbolPostfix}].compStyle` : '', this._cstyId, this._underMode_T),
        DEFAULT: elements.length > 0 ? this._prependTab(this._gen_render(elements, vmLevel)) : 'null'
      })
    };
  }

  _assert_arg_pass(tokenPosition, elements, Component) {
    let found = 0;
    const args = {};
    elements.forEach(el => {
      if (el.type === 'component' && el.sub === 'argument') {
        if (found < 0) {
          this._throwParseError(tokenPosition, `children of <${Component}> must satisfy the requirement that all of them contain slot-pass: attribute or none of them contain slot-pass: attribute`);
        }
        if (el.argPass in args) {
          this._throwParseError(tokenPosition, `slot-pass: attribute name must be unique under <${Component}>, but found duplicate: ${el.argPass}`);
        }
        args[el.argPass] = true;
        found = 1;
      } else {
        if (found > 0) {
          this._throwParseError(tokenPosition, `children of <${Component}> must satisfy the requirement that all of them contain slot-pass: attribute or none of them contain slot-pass: attribute`);
        }
        found = -1;
      }
    });
    return found > 0;
  }

  _parse_translate(ctx) {
    if (this._underMode_T) {
      this._throwParseError(ctx.start, '<_t> component cannot have <_t> child');
    }

    const defaultLocaleContentNodes = ctx.htmlNode();
    if (defaultLocaleContentNodes.length === 0) {
      // meet empty <_t></_t>
      return null;
    }

    if (i18nManager.written) {
      /**
       * 如果多语言脚本资源已经处理过了（i18nManager.written === true），说明是在
       *   启用了 watch 的研发模式下，文件发生变化后重新编译，这种情况下，由于多方面的复杂
       *   问题不好解决，暂时先简化为不做多语言的处理。
       */
      const code = defaultLocaleContentNodes.map(n => {
        return this.visitHtmlNode(n);
      }).filter(el => !!el).map(r => r.value).join(',\n');
      return {
        type: 'component',
        sub: 'normal',
        value: code
      };
    }

    i18nManager.assertPluginInstalled();
    /*
     * check translate <_t> component type
     *   0: text without any expression, such as <_t>Hello, World</t>
     *   1: text with expression, such as <_t>Hello, ${boy}</t>
     *   2: text with complex children, such as <_t>Hello, <span>${body}</span></_t>
     */
    let type = 0;
    const innerHtml = defaultLocaleContentNodes.map(c => {
      if (c.ruleIndex !== TemplateParser.RULE_htmlNode || c.children.length !== 1) {
        throw new Error('unimpossible!?');
      }
      c = c.children[0];
      if (c.ruleIndex === TemplateParser.RULE_htmlComment) {
        // ignore comment
        return '';
      }
      if (c.ruleIndex === TemplateParser.RULE_htmlElement) {
        // 尽管 antlr 里面已经使用 channel(HIDDEN) 而不是 skip，
        // 仍然无法通过 getText() 返回带空格的完整数据。
        // 因此此处使用 substring 直接截取。
        type = 2;
        return this._source.substring(c.start.start, c.stop.stop + 1);
      }
      if (c.ruleIndex !== TemplateParser.RULE_htmlTextContent) {
        throw new Error('unimpossible?!');
      }
      if (c.children.find(cc => {
        return cc.ruleIndex === TemplateParser.RULE_htmlExpr;
      })) {
        type = 1;
      }
      return c.getText();
    }).join('').trim().replace(/\n\s*/g, '');
    if (type === 0) {
      const key = i18nManager.registerToDict(innerHtml, this._resourcePath);
      return {
        type: 'component',
        sub: 'normal',
        value: `i18nRenderFn${sharedOptions.symbolPostfix}(component, ${JSON.stringify(key)}, ${this._parent.type === 'component'})`
      };
    }

    const args = ['component', 'cstyId', 'vm_0', ...this._vms.map((vm, i) => `vm_${i + 1}`)];
    const registerI18N = (renderOfContentNodes) => {
      [new RegExp(`[\\w\\d$_]+${sharedOptions.symbolPostfix}`, 'g'), new RegExp(`[\\w\\d$_]+${aliasManager.aliasPostfix}`, 'g'), new RegExp(`[\\w\\d$_]+${this._importPostfix}`, 'g')].forEach(reg => {
        [...renderOfContentNodes.matchAll(reg)].forEach(m => {
          if (this._i18nRenderDeps.keys.has(m[0])) return;
          this._i18nRenderDeps.keys.set(m[0], true);
          const idx = i18nManager.registerRenderDep(m[0]);
          if (idx >= 0) {
            this._i18nRenderDeps.codes.push(`i18n${sharedOptions.symbolPostfix}.__regDep(${idx}, ${m[0]});`);
          }
        });
      });
    }
    const key = i18nManager.registerToRender(innerHtml, this._resourcePath, (locale, contentOrNodes) => {
      if (typeof contentOrNodes === 'string') {
        if (!contentOrNodes) {
          contentOrNodes = defaultLocaleContentNodes;
        } else {
          const [err, tree] = parse(contentOrNodes);
          if (err) {
            this._webpackLoaderContext.emitError(new Error(`i18n parse error locale "${locale}" at ${this._resourcePath}`));
            contentOrNodes = defaultLocaleContentNodes;
          } else {
            contentOrNodes = tree.children;
          }
        }
      }
      this._underMode_T = true;
      // <_t> 会被转成 <I18nComponent>
      this._enter(null, {
        type: 'component',
        sub: 'argument'
      });
      let renderOfContentNodes = contentOrNodes.map(n => {
        return this.visitHtmlNode(n);
      }).filter(el => !!el).map(r => r.value).join(',\n');
      this._exit();
      this._underMode_T = false;
      registerI18N(renderOfContentNodes);
      const renderFnCode = `function(${args.join(', ')}) { return [
${prependTab(renderOfContentNodes, true, 4)}
  ]}`;
      return renderFnCode;
    }, (renderOfContentNodes) => {
      registerI18N(renderOfContentNodes);
    });

    const isParentComponent = this._parent.type === 'component';
    const code = this._replace_tpl(TPL.I18N, {
      PUSH_ELE: this._replace_tpl(isParentComponent ? TPL.PUSH_ROOT_ELE : TPL.PUSH_COM_ELE),
      RENDER_KEY: JSON.stringify(key),
      VMS: args.slice(2).join(', '),
      CSTYLE_PID: genCstylePid(
        isParentComponent ? `component[__${sharedOptions.symbolPostfix}].compStyle` : '', 
        // _t 对应的 I18n 组件，只需要处理从父组件继承的 component style，
        // 不需要添加模板的 cstyId。
        false, false
      ),
      // 模板的 cstyId 单独传递给组件作特殊处理。
      CSTYID: this._cstyId ? `cstyId` : 'null',
    });

    return {
      type: 'component',
      sub: 'normal',
      value: code
    };
  }

  _parse_component_ele(tag, Component, ctx) {
    const result = this._parse_attrs('component', Component, ctx, this._parent);
    /**
     * for 组件也是一个标准组件，并没有特殊性，且组件别名也可以被覆盖。因此只给予避免踩杭的告警，
     * 而不是抛出错误。
     */
    if (tag === 'for' && !result.vms.find(v => v.reflect === 'each')) {
      this._logParseError(ctx.start, '<for> component require vm:each attribute.', 'Warning');
    }
    let elements = this._visit_child_nodes(ctx, result.vms, {
      type: 'component',
      sub: (result.argPass || result.vms.length > 0) ? 'argument' : (
        result.argUse ? 'parameter' : 'normal'
      ),
      vms: result.vms
    });
    if (tag === '_slot' && elements.length === 0 && result.argPass) {
      this._throwParseError(ctx.start, '<_slot> component with slot-pass: attribute must have child.');
    }
    const hasArg = this._assert_arg_pass(ctx.start, elements, tag);
    if (result.vms.length > 0 && !result.argPass && hasArg) {
      this._throwParseError(ctx.start, 'if component has vm-use: attribute but do not have slot-pass: attribute, it\'s root children can\'t have slot-pass: attribute.');
    }
    const setRefCode = result.ref ? this._replace_tpl(TPL.SET_REF_ELE, {
      NAME: result.ref
    }) : '';
    const vmLevel = result.vms.length > 0 ? result.vms[result.vms.length - 1].level : -1;
    if (tag === '_slot' && result.argUse) {
      return this._parse_arg_use_parameter(
        elements, result.argUse, result.vmPass, vmLevel
      );
    }

    if (tag === '_slot' && result.argPass) {
      return {
        type: 'component',
        sub: 'argument',
        argPass: result.argPass,
        value: this._gen_render(elements, vmLevel)
      };
    }

    if (elements.length > 0 && !hasArg) {
      elements = [{
        type: 'component',
        sub: 'argument',
        argPass: 'default',
        value: this._gen_render(elements, vmLevel)
      }];
    }

    const attrs = [];
    result.argAttrs.length > 0 && attrs.push(...result.argAttrs.map(at => `${attrN(at[0])}: null`));
    result.translateAttrs.length > 0 && attrs.push(...result.translateAttrs.map(at => `${at[0]}: null`));
    result.constAttrs.length > 0 && attrs.push(...result.constAttrs.map(at => `${attrN(at[0])}: ${JSON.stringify(at[1])}`));
    
    const needAddParentStyId = result.argPass || this._parent.type === 'component';
    const cstyle = genCstylePid(
      needAddParentStyId ? `component[__${sharedOptions.symbolPostfix}].compStyle` : '',
      this._underMode_T ? true : this._cstyId,
      this._underMode_T
    );
    const vmAttrs = `const attrs = attrs${sharedOptions.symbolPostfix}({
  [__${sharedOptions.symbolPostfix}]: {
${!this._isProdMode ? `    debugName: "attrs_of_<${tag}>",` : ''}
${cstyle ? '    ' + cstyle : ''}
${this._prependTab(`  context: component[__${sharedOptions.symbolPostfix}].context,`)}
${result.listeners.length > 0 ? this._prependTab(`  listeners: {
${result.listeners.map(lt => `    ${attrN(lt[0])}: { fn: function(...args) { ${lt[1].code} }, opts: ${lt[1].tag ? `${JSON.stringify(lt[1].tag)}` : 'null'} }`)}
},`) : ''}
${elements.length > 0 ? this._prependTab(`  slots: {
${elements.map(el => `    '${el.argPass}': ${el.value}`).join(',\n')}
}`) : ''}
  },
${this._prependTab(attrs.join(',\n'), true)}
});
${result.argAttrs.map((at, i) => this._replace_tpl(at[1], {
  REL_COM: `component[$$${sharedOptions.symbolPostfix}]`,
  ROOT_INDEX: i.toString(),
    RENDER_START: `attrs.${at[0]} = `,
    RENDER_END: ';'
  })).join('\n')}
${result.translateAttrs.map((at, i) => {
      return this._parse_i18n_attr(at, result.argAttrs.length + i, false);
  }).join('\n')}`;

    const code = '...(() => {\n' + this._prependTab(`
${vmAttrs}
const el = ${Component}.create(attrs);
${result.translateAttrs.map((at, i) => {
  at = at[1];
  if (at.type === 'const') {
    return this._replace_tpl(TPL.ATTR_I18N_COMP_CONST_OFF, {
      ROOT_INDEX: (result.argAttrs.length + i).toString()
    });
  } else {
    return this._replace_tpl(TPL.ATTR_I18N_COMP_EXPR_OFF, {
      ROOT_INDEX: (result.argAttrs.length + i).toString()
    });
  }
}).join('\n')}
${setRefCode}
${this._parent.type === 'component' ? this._replace_tpl(TPL.PUSH_ROOT_ELE) : this._replace_tpl(TPL.PUSH_COM_ELE)}
return assertRenderResults${sharedOptions.symbolPostfix}(el.__render());`, true) + '\n})()';

    const rtnEl = {
      type: 'component', sub: 'normal', value: code
    };

    if (result.argUse) {
      return this._parse_arg_use_parameter(
        [rtnEl], result.argUse, result.vmPass, vmLevel
      );
    }
    if (result.argPass) {
      return {
        type: 'component',
        sub: 'argument',
        argPass: result.argPass,
        value: this._gen_render([rtnEl], vmLevel)
      };
    }
    return rtnEl;
  }

  _parse_expr_memeber_node(memExpr, startLine) {
    const paths = [];
    let computed = -1; // -1: no computed, 0: only have Literal computed, 1: member expression computed
    let root = null;
    const walk = node => {
      const objectExpr = node.object;
      const propertyExpr = node.property;
      if (node.computed) {
        if (propertyExpr.type === 'Literal') {
          paths.unshift({
            type: 'const',
            value: propertyExpr.value
          });
          if (computed < 0) computed = 0;
        } else {
          computed = 1;
          paths.unshift({
            type: 'computed',
            value: node
          });
        }
      } else {
        if (propertyExpr.type !== 'Identifier') {
          throw node.loc.start;
        } else {
          paths.unshift({
            type: 'const',
            value: propertyExpr.name
          });
        }
      }
      if (objectExpr.type === 'Identifier') {
        root = objectExpr;
        paths.unshift({
          type: 'const',
          value: objectExpr.name
        });
      } else {
        if (objectExpr.type !== 'MemberExpression') {
          throw node.loc.start;
        } else {
          walk(objectExpr);
        }
      }
    };

    try {
      walk(memExpr);
    } catch (loc) {
      this._throwParseError({
        line: startLine + loc.line - 1,
        column: loc.column
      }, 'expression not support. see https://[todo]');
    }
    return {
      root,
      memExpr,
      computed,
      paths
    };
  }

  _parse_expr_node(info, expr, levelPath) {
    const computedMemberExprs = [];
    const watchPaths = [];
    const addPath = p => {
      if (!watchPaths.find(ep => ep.vm === p.vm && ep.n === p.n)) watchPaths.push(p);
    };
    const replaceExpr = (nodeExpr, root, props) => {
      if (props.length <= 1) return;

      /*
       * convert member expression to optional chain expression:
       *   a.b.c["d"].e ===>  a?.b?.c?.["d"]?.e
       * TODO: use browser optional chain when acorn supported.
       *   https://github.com/acornjs/acorn/pull/891
       */
      
      const _decl = {
        type: 'VariableDeclaration',
        declarations: new Array(props.length - 1).fill(0).map((n, i) => ({
          type: 'VariableDeclarator',
          id: { type: 'Identifier', name: `_${i}` },
          init: null
        })),
        kind: 'let'
      };
      let tmp;
      props.forEach((p, i) => {
        if (i === 0) {
          tmp = {
            type: 'Identifier',
            name: root.name
          };
          return;
        }
        const isSp = p.type === 'const' && isSimpleProp(p.value);
        tmp = {
          type: 'ConditionalExpression',
          alternate: {
            type: 'MemberExpression',
            computed: !isSp,
            object: {
              type: 'Identifier',
              name: `_${i - 1}`
            },
            property: isSp || p.type === 'id' ? {
              type: 'Identifier',
              name: p.value
            } : {
              type: 'Literal',
              value: p.value
            }
          },
          consequent: {
            type: 'UnaryExpression',
            operator: 'void',
            argument: {
              type: 'Literal',
              value: 0,
              raw: '0'
            },
            prefix: true
          },
          test: {
            type: 'LogicalExpression',
            operator: '||',
            left: {
              type: 'BinaryExpression',
              operator: '===',
              left: {
                type: 'AssignmentExpression',
                operator: '=',
                left: {
                  type: 'Identifier',
                  name: `_${i - 1}`
                },
                right: tmp
              },
              right: {
                type: 'Literal',
                value: null,
                raw: 'null'
              }
            },
            right: {
              type: 'BinaryExpression',
              operator: '===',
              left: {
                type: 'Identifier',
                name: `_${i - 1}`
              },
              right: {
                type: 'UnaryExpression',
                operator: 'void',
                argument: {
                  type: 'Literal',
                  value: 0,
                  raw: '0'
                },
                prefix: true
              }
            }
          }
        };
      });
      const _rtn = {
        type: 'ReturnStatement',
        argument: tmp
      };
      nodeExpr.type = 'CallExpression';
      nodeExpr.callee = {
        type: 'FunctionExpression',
        id: null,
        params: [],
        body: {
          type: 'BlockStatement',
          body: [_decl, _rtn]
        },
        generator: false,
        expression: false,
        async: false
      };
      nodeExpr.arguments = [];
    };
    const convert = (nodeExpr, root, props) => {
      const varName = root.name;
      const vmVar = this._vms.find(v => v.name === varName);
      const level = vmVar ? vmVar.level : 0;
      root.name = `vm_${level}.${vmVar ? vmVar.reflect : varName}`;

      replaceExpr(nodeExpr, root, props);

      if (varName.startsWith('_')) {
        // do not need watch private property.
        return;
      }
      if (vmVar) {
        props[0].value = vmVar.reflect;
      }
      addPath({
        vm: `vm_${level}`,
        n: JSON.stringify(props.map(p => p.value))
      });
    };

    this._walkAcorn(expr, {
      CallExpression: node => {
        this._throwParseError({
          line: info.startLine + node.loc.start.line - 1,
          column: node.loc.start.column
        }, 'Function call is not allowed in expression');
      },
      Identifier: node => {
        convert(node, node, [{
          type: 'const',
          value: node.name
        }]);
        return false;
      },
      MemberExpression: node => {
        const mn = this._parse_expr_memeber_node(node, info.startLine);
        if (mn.computed < 1) {
          convert(mn.memExpr, mn.root, mn.paths);
        } else {
          computedMemberExprs.push(mn);
        }
        return false;
      }
    });

    const levelId = levelPath.join('_');
    const parentLevelId = levelPath.slice(0, levelPath.length - 1).join('_');

    if (computedMemberExprs.length === 0) {
      if (levelPath.length === 1) {
        const needWrapViewModel = expr.type === 'ObjectExpression' || expr.type === 'ArrayExpression';
        return ['', `const fn_$ROOT_INDEX$ = () => {\n  $RENDER_START$${needWrapViewModel ? `vm${sharedOptions.symbolPostfix}(` : ''}${escodegen.generate(expr)}${needWrapViewModel ? ')' : ''}$RENDER_END$\n};`, 'fn_$ROOT_INDEX$();', '', `${watchPaths.map(p => `${p.vm}[$$${sharedOptions.symbolPostfix}].__watch(${p.n}, fn_$ROOT_INDEX$, $REL_COM$);`).join('\n')}`];
      } else {
        return [`let _${levelId};`, `function _calc_${levelId}() {
  _${levelId} = ${escodegen.generate(expr)};
}`, `_calc_${levelId}();`, `function _update_${levelId}() {
  _calc_${levelId}();
  _notify_${parentLevelId}();
  _update_${parentLevelId}();
}`, `${watchPaths.map(p => `${p.vm}[$$${sharedOptions.symbolPostfix}].__watch(${p.n}, _update_${levelId}, $REL_COM$);`).join('\n')}`];
      }
    } else {
      const assignCodes = [];
      const calcCodes = [];
      const initCodes = [];
      const updateCodes = [];
      const watchCodes = [];
      computedMemberExprs.forEach((cm, i) => {
        const lv = levelPath.slice().concat([i.toString()]);
        const lv_id = lv.join('_');
        const __p = [];
        let __si = 0;
        assignCodes.push(`let _${lv_id};\nlet _${lv_id}_p;`);
        cm.paths.forEach((cmp, pidx) => {
          if (cmp.type === 'const') {
            __p.push(JSON.stringify(cmp.value));
            return;
          }
          const llv = lv.slice().concat([(__si++).toString()]);
          const [_ac, _cc, _ic, _uc, _wc] = this._parse_expr_node(info, cmp.value.property, llv);
          _ac && assignCodes.push(_ac);
          _cc && calcCodes.push(_cc);
          _ic && initCodes.push(_ic);
          _uc && updateCodes.unshift(_uc);
          _wc && watchCodes.push(_wc);
          cmp.value.property = {
            type: 'Identifier',
            name: `_${llv.join('_')}`
          };
          __p.push(cmp.value.property.name);
          cm.paths[pidx] = {
            type: 'id',
            value: cmp.value.property.name
          };
        });
        const vmVar = this._vms.find(v => v.name === cm.root.name);
        const level = vmVar ? vmVar.level : 0;
        cm.root.name = `vm_${level}.${vmVar ? vmVar.reflect : cm.root.name}`;
        if (vmVar) {
          __p[0] = `'${vmVar.reflect}'`;
        }
        replaceExpr(cm.memExpr, cm.root, cm.paths);
        calcCodes.push(`function _calc_${lv_id}() {
  _${lv_id} = ${escodegen.generate(cm.memExpr)};
}`);
        updateCodes.unshift(`function _update_${lv_id}() {
  _calc_${lv_id}();
  _update_${levelId}();
}
function _notify_${lv_id}() {
  const _np = [${__p.join(', ')}];
  const _eq = _${lv_id}_p && arrayEqual${sharedOptions.symbolPostfix}(_${lv_id}_p, _np);
  if (_${lv_id}_p && !_eq) {
    vm_${level}[$$${sharedOptions.symbolPostfix}].__unwatch(_${lv_id}_p, _update_${lv_id}, $REL_COM$);
  }
  if (!_${lv_id}_p || !_eq) {
    _${lv_id}_p = _np;
    vm_${level}[$$${sharedOptions.symbolPostfix}].__watch(_${lv_id}_p, _update_${lv_id}, $REL_COM$);
  }
}`);
        initCodes.push(`_calc_${lv_id}();`);
        watchCodes.push(`_notify_${lv_id}();`);
        cm.memExpr.type = 'Identifier';
        cm.memExpr.name = `_${lv_id}`;
      });

      if (levelPath.length === 1) {
        const needWrapViewModel = expr.type === 'ObjectExpression' || expr.type === 'ArrayExpression';
        calcCodes.push(`function _calc_${levelId}() {
  $RENDER_START$${needWrapViewModel ? `vm${sharedOptions.symbolPostfix}(` : ''}${escodegen.generate(expr)}${needWrapViewModel ? ')' : ''}$RENDER_END$
}`);
        initCodes.push(`_calc_${levelId}();`);
        updateCodes.unshift(`function _update_${levelId}() { _calc_${levelId}(); }`);
        watchCodes.push(`${watchPaths.map(p => `${p.vm}[$$${sharedOptions.symbolPostfix}].__watch(${p.n}, _calc_${levelId}, $REL_COM$);`).join('\n')}`);
      } else {
        calcCodes.push(`function _calc_${levelId}() {
  _${levelId} = ${escodegen.generate(expr)};
}`);
        updateCodes.unshift(`function _update_${levelId}() {
  _calc_${levelId}();
  _notify_${parentLevelId}();
}`);
        initCodes.push(`_calc_${levelId}();`);
        watchCodes.push(`${watchPaths.map(p => `${p.vm}[$$${sharedOptions.symbolPostfix}].__watch(${p.n}, _update_${levelId}, $REL_COM$);`).join('\n')}`);
      }

      return [
        assignCodes.join('\n'),
        calcCodes.join('\n'),
        initCodes.join('\n'),
        updateCodes.join('\n'),
        watchCodes.join('\n')
      ];
    }
  }

  _parse_expr(txt, ctx) {
    // console.log(txt);
    txt = txt.trim();
    if (txt === 'class' || /\bclass\b/.test(txt)) {
      this._throwParseError(ctx.start, 'expression can\'t contain js keyword class');
    }
    let mayBeObject = false;
    let mayBeArray = false;
    /*
     * if expression startsWith '{', we treat it as ObjectExpression.
     * we wrap it into '()' to treat it as ObjectExpression.
     */
    if (txt[0] === '{') {
      mayBeObject = true;
      txt = '(' + txt + ')';
    } else if (txt[0] === '[') {
      mayBeArray = true;
    }
    let expr;
    try {
      expr = acorn.Parser.parse(txt, {
        locations: true
      });
    } catch (ex) {
      this._throwParseError(ctx.start, 'expression grammar error.');
    }
    if (expr.body.length > 1 || expr.body[0].type !== 'ExpressionStatement') {
      // console.log(ctx.start.line, this._baseLinePosition);
      this._throwParseError(ctx.start, 'expression only support single ExpressionStatement. see https://[todo].');
    }
    expr = expr.body[0].expression;
    if (mayBeObject && expr.type !== 'ObjectExpression') {
      this._throwParseError(ctx.start, 'expression startsWith "{" must be ObjectExpression. see https://[todo].');
    }
    if (mayBeArray && expr.type !== 'ArrayExpression') {
      this._throwParseError(ctx.start, 'expression startsWith "[" must be ArrayExpression. see https://[todo].');
    }
    const info = {
      startLine: ctx.start.line,
      vars: []
    };
    return this._parse_expr_node(info, expr, ['$ROOT_INDEX$']);
  }

  _join_elements(elements) {
    return elements.map(el => el.value).join(',\n');
  }

  _gen_render(elements, vmLevel = -1) {
    const body = this._prependTab(`${vmLevel >= 0 ? `const vm_${vmLevel} = component;
${this._cstyId ? `const cstyId = "${this._cstyId}";` : ''}` : ''}
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
    return {
      renderFn: this._gen_render(elements, 0),
      i18nDeps: this._i18nRenderDeps.codes.join('\n'),
      aliasImports: aliasManager.getCode(this._aliasImports),
      imports: this._importOutputCodes.join('\n').trim()
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
        if (!txt.trim()) return;
        try {
          txt = HTMLEntities.decode(txt);
        } catch (ex) {
          this._throwParseError(ctx.start, ex.message);
        }
        txt = JSON.stringify(txt);
        eles.push(this._parent.type === 'html' ? txt : this._replace_tpl(TPL.TEXT_CONST, {
          VAL: txt
        }));
      } else {
        txt = txt.substring(2, txt.length - 1).trim(); // extract from '${}'
        if (!txt) return;
        const result = this._replace_tpl(this._parse_expr(txt, cn).join('\n'), {
          REL_COM: `component[$$${sharedOptions.symbolPostfix}]`,
          ROOT_INDEX: '0',
          RENDER_START: 'setText$POSTFIX$(el, ',
          RENDER_END: ');'
        });
        eles.push(this._replace_tpl(TPL.TEXT_EXPR, {
          PUSH_ELE: this._parent.type === 'component' ? this._replace_tpl(TPL.PUSH_ROOT_ELE) : '',
          CODE: this._prependTab(result)
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
      this._throwParseError(endT.start, `close tag <${endT.getText()}> does not match open <${etag}>`);
    }
    if (etag.startsWith('_') && etag !== '_t' && etag !== '_slot') {
      this._throwParseError(ctx.start, 'html tag starts with "_" is compiler preserved tag name. Current version only support: "<_t>" and "<_slot>". see https://todo"');
    }

    if (etag === '_t') {
      return this._parse_translate(ctx);
    } else if (etag === '_slot') {
      return this._parse_component_ele(etag, etag, ctx);
    } else if (/^[a-z\d_-]+$/.test(etag)) {
      const componentTag = aliasManager.getComponentOfAlias(etag, this._aliasImports);
      if (componentTag) {
        return this._parse_component_ele(etag, componentTag, ctx);
      }
      if (etag !== 'svg' && this._parent.isSVG && SVGTags.indexOf(etag) < 0) {
        this._logParseError(ctx.start, `${etag} is not known svg tag.`);
      }
      if (etag !== 'svg' && !this._parent.isSVG && HTMLTags.indexOf(etag) < 0) {
        this._logParseError(ctx.start, `'${etag}' is not known html tag, do you forgot to config component alias?`, 'Warning');
      }
      return this._parse_html_ele(etag, ctx);
    }
    if (!(etag in this._imports)) {
      this._throwParseError(ctx.start, `Component '${etag}' not found. Forgot to import it on the top?`);
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
        locations: true,
        sourceType: 'module'
      });
    } catch (ex) {
      this._webpackLoaderContext.emitError(new Error(`Warning: keyword "import" is found in comment, but got error when tring to parse it as js code. see https://[todo]
 > ${ex.message}
 > ${this._resourcePath}`));
      return;
    }
    tree.body = tree.body.filter(node => {
      if (node.type !== 'ImportDeclaration') return false;
      const specifiers = [];
      for (let i = 0; i < node.specifiers.length; i++) {
        const spec = node.specifiers[i];
        const local = spec.local.name;
        if (!/^[A-Z][a-zA-Z\d]*$/.test(local)) {
          this._throwParseError({
            line: ctx.start.line + spec.loc.start.line - 1,
            column: spec.loc.start.column
          }, 'Imported component name must match /^[A-Z][a-zA-Z\\d]+$/. see https://[todo]');
        }
        if (local in this._imports) {
          this._throwParseError({
            line: ctx.start.line + spec.loc.start.line - 1,
            column: spec.loc.start.column
          }, 'Dulplicate imported component name: ' + local);
        }

        let src = node.source.value;
        if (src === '.') {
          this._imports[local] = local;
          // skip import XX from '.', which means Component used is in same file.
          continue;
        }
        if (src.startsWith('.')) {
          src = path.resolve(
            path.dirname(this._resourcePath),
            src
          );
        }
        const hash = crypto.createHash('md5');
        this._imports[local] = local + '_' + hash.update(src).digest('hex').substr(0, 12) + this._importPostfix;
        spec.local = {
          type: 'Identifier', name: this._imports[local]
        };
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
    const output = escodegen.generate(tree, {
      indent: ''
    });
    // console.log(output);
    this._importOutputCodes.push(output);
    return null;
  }
}

module.exports = {
  TemplateVisitor
};
