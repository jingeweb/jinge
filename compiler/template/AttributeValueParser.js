const antlr = require('antlr4');
const { AttrParser } = require('./parser/AttrParser');
const { AttrLexer } = require('./parser/AttrLexer');

class AttributeValueParser extends AttrParser {
  static parse(content) {
    const lexer = new AttrLexer(new antlr.InputStream(content));
    const tokens = new antlr.CommonTokenStream(lexer);
    // console.log(lexer.getAllTokens().map(t => t.text));
    const parser = new AttributeValueParser(tokens);
    parser.buildParseTrees = false;
    parser.value();

    return parser._results.map((r) => {
      const t = r[1];
      return {
        type: r[0] === 0 ? 'TEXT' : 'VAR',
        value: r[0] === 0 ? t : t.substring(2, t.length - 1).trim(),
      };
    });
  }

  constructor(...args) {
    super(...args);
    this._results = [];
  }
}

module.exports = {
  AttributeValueParser,
};
