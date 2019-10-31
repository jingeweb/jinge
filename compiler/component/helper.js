const path = require('path');
const {
  isArray,
  getUniquePostfix
} = require('../util');

const jingeEntryFile = path.resolve(__dirname, '../../index.js');
const jingeUtilFile = path.resolve(__dirname, '../../util/index.js');
const jingeUtilCommonFile = path.resolve(__dirname, '../../util/common.js');

const BASE_UNIQUE_POSTFIX = getUniquePostfix();

function _n_wrap(attrArgName) {
  return {
    type: 'VariableDeclaration',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: {
          type: 'Identifier',
          name: `vm${BASE_UNIQUE_POSTFIX}`
        },
        init: {
          type: 'CallExpression',
          callee: {
            type: 'Super'
          },
          arguments: [{
            type: 'Identifier',
            name: attrArgName
          }]
        }
      }
    ],
    kind: 'const'
  };
}

function _n_vm(idx, stmt, an, props) {
  return [{
    type: 'VariableDeclaration',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: {
          type: 'Identifier',
          name: `fn_${idx}${BASE_UNIQUE_POSTFIX}`
        },
        init: {
          type: 'ArrowFunctionExpression',
          id: null,
          params: [],
          body: {
            type: 'BlockStatement',
            body: [
              // {
              //   type: 'IfStatement',
              //   test: {
              //     type: 'MemberExpression',
              //     computed: true,
              //     object: {
              //       type: 'Identifier',
              //       name: `vm_${RND_ID}`
              //     },
              //     property: {
              //       type: 'Identifier',
              //       name: `VM_DESTROIED_${RND_ID}`
              //     }
              //   },
              //   consequent: {
              //     type: 'ReturnStatement',
              //     argument: null
              //   },
              //   alternate: null
              // },
              stmt
            ]
          },
          generator: false,
          expression: false,
          async: false
        }
      }
    ],
    kind: 'const'
  },
  {
    type: 'ExpressionStatement',
    expression: {
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: `fn_${idx}${BASE_UNIQUE_POSTFIX}`
      },
      arguments: []
    }
  }].concat(props.map(prop => {
    return {
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          computed: true,
          object: {
            type: 'MemberExpression',
            computed: true,
            object: {
              type: 'Identifier',
              name: an
            },
            property: {
              type: 'Identifier',
              name: `VM_ATTRS${BASE_UNIQUE_POSTFIX}`
            }
          },
          property: {
            type: 'Identifier',
            name: `VM_ON${BASE_UNIQUE_POSTFIX}`
          }
        },
        arguments: [isArray(prop) ? {
          type: 'ArrayExpression',
          elements: prop.map(p => ({
            type: 'Literal',
            value: p,
            raw: JSON.stringify(p)
          }))
        } : {
          type: 'Literal',
          value: prop,
          raw: JSON.stringify(prop)
        }, {
          type: 'Identifier',
          name: `fn_${idx}${BASE_UNIQUE_POSTFIX}`
        }]
      }
    };
  }));
}

module.exports = {
  BASE_UNIQUE_POSTFIX,
  jingeEntryFile,
  jingeUtilCommonFile,
  jingeUtilFile,
  _n_wrap,
  _n_vm
};
