const antlr = require('antlr4/index');
const { TemplateParser } = require('./parser/TemplateParser');
const { TemplateLexer } = require('./parser/TemplateLexer');

function parse(source) {
  const lexer = new TemplateLexer(new antlr.InputStream(source));
  const tokens = new antlr.CommonTokenStream(lexer);
  // console.log(lexer.getAllTokens().map(t => {
  //   console.log(t.text);
  //   return  t.text;
  // }));
  // debugger;
  const parser = new TemplateParser(tokens);
  let meetErr = null;
  parser.removeErrorListeners();
  parser.addErrorListener({
    syntaxError(recognizer, offendingSymbol, line, column, ...args) {
      // eslint-disable-next-line no-console
      console.error(...args);
      if (!meetErr) {
        meetErr = {
          line,
          column,
        };
      }
    },
    reportContextSensitivity() {},
    reportAttemptingFullContext() {},
    reportAmbiguity() {},
  });
  const tree = parser.html();
  return [meetErr, tree];
}

module.exports = {
  parse,
};
