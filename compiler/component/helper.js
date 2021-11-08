const { isArray } = require('../util');

function _n_wrap(postfix) {
  return {
    type: 'VariableDeclaration',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: {
          type: 'Identifier',
          name: `__vm${postfix}`,
        },
        init: {
          type: 'MemberExpression',
          object: {
            type: 'MemberExpression',
            object: {
              type: 'ThisExpression',
            },
            property: {
              type: 'Identifier',
              name: `__$$${postfix}`,
            },
            computed: true,
          },
          property: {
            type: 'Identifier',
            name: 'proxy',
          },
          computed: false,
        },
      },
    ],
    kind: 'const',
  };
}

function _n_vm(idx, stmt, an, props, postfix) {
  return [
    {
      type: 'VariableDeclaration',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: {
            type: 'Identifier',
            name: `fn_${idx}${postfix}`,
          },
          init: {
            type: 'ArrowFunctionExpression',
            id: null,
            params: [],
            body: {
              type: 'BlockStatement',
              body: [stmt],
            },
            generator: false,
            expression: false,
            async: false,
          },
        },
      ],
      kind: 'const',
    },
    {
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: `fn_${idx}${postfix}`,
        },
        arguments: [],
      },
    },
  ].concat(
    props.map((prop) => {
      return {
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            computed: false,
            object: {
              type: 'MemberExpression',
              computed: true,
              object: {
                type: 'Identifier',
                name: an,
              },
              property: {
                type: 'Identifier',
                name: `__$$${postfix}`,
              },
            },
            property: {
              type: 'Identifier',
              name: `__watch`,
            },
          },
          arguments: [
            isArray(prop)
              ? {
                  type: 'ArrayExpression',
                  elements: prop.map((p) => ({
                    type: 'Literal',
                    value: p,
                    raw: JSON.stringify(p),
                  })),
                }
              : {
                  type: 'Literal',
                  value: prop,
                  raw: JSON.stringify(prop),
                },
            {
              type: 'Identifier',
              name: `fn_${idx}${postfix}`,
            },
          ],
        },
      };
    }),
  );
}

module.exports = {
  _n_wrap,
  _n_vm,
};
