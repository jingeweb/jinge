const antlr = require('antlr4');
const ImportParser = require('./parser/ImportParser');
const ImportLexer = require('./parser/ImportLexer');

class ExtractImportLocalParser extends ImportParser {
  static parse(content) {
    const locals = [];
    const imports = [];
    // debugger;
    // console.log(content);
    const lexer = new ImportLexer(new antlr.InputStream(content));
    const tokens = new antlr.CommonTokenStream(lexer);
    // const ts = lexer.getAllTokens();
    // debugger;
    const parser = new ExtractImportLocalParser(tokens);
    let meetErr = false;
    // parser._errHandler = new BailErrorStrategy();
    parser.removeErrorListeners();
    parser.addErrorListener({
      syntaxError() {
        // console.log(args.length);
        meetErr = true;
      },
      reportContextSensitivity() {},
      reportAttemptingFullContext() {},
      reportAmbiguity() {},
    });
    parser.buildParseTrees = false;
    parser.stmts();
    // console.log(parser._locals, parser._imports);
    if (!meetErr) {
      locals.push(...parser.__jingeLocals.map((token) => token.text));
      imports.push(...parser.__jingeImports);
    }
    return {
      locals,
      imports,
    };
  }

  constructor(...args) {
    super(...args);
    this.__jingeLocals = [];
    this.__jingeImports = [];
  }
}

module.exports = {
  ExtractImportLocalParser,
};
