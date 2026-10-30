const ts = require('typescript');

// Vite injects import.meta.env in app builds. Jest supplies MODE at runtime so
// tests can select development/production without replacing the error utility.
module.exports = {
  name: 'jinge-test-vite-env',
  version: 1,
  factory: () => (context) => {
    const visit = (node) => {
      if (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === 'env' &&
        ts.isMetaProperty(node.expression) &&
        node.expression.keywordToken === ts.SyntaxKind.ImportKeyword
      ) {
        return ts.factory.createObjectLiteralExpression([
          ts.factory.createPropertyAssignment(
            'MODE',
            ts.factory.createPropertyAccessExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier('process'),
                'env',
              ),
              'NODE_ENV',
            ),
          ),
        ]);
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (sourceFile) => ts.visitNode(sourceFile, visit);
  },
};
