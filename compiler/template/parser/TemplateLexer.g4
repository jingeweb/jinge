lexer grammar TemplateLexer;

COMMENT: '<!--' .*? '-->';
TAG_OPEN: '<' -> pushMode(TAG);

EXPR_START: '${' -> pushMode(EXPR);
TEXT: ('\\$' | ('$' ~'{') | ~[<$])+;

mode EXPR;

EXPR_END: '}' -> popMode;

EXPR_SEG:
  DOUBLE_QUOTE_STRING | SINGLE_QUOTE_STRING | EXPR_TEXT
;
EXPR_TEXT: (~[`}])+;
TPL_STR_START: '`' -> pushMode(TPL_STR);

mode TPL_STR;

TPL_STR_END: '`' -> popMode;
TPL_STR_TEXT: ('\\`' | '\\$' | ~[`$] | ('$' ~'{'))+;
TPL_EXPR_START: '${' -> pushMode(EXPR);

mode TAG;

TAG_SLASH: '/';
TAG_NAME: TAG_NameStartChar TAG_NameChar* -> pushMode(ATTR);
TAG_WHITESPACE: [ \t\r\n] -> channel(HIDDEN);

mode ATTR;

ATTR_NAME: ATTR_NameStartChar ATTR_NameChar*;
ATTR_EQUAL: '=';
ATTR_VALUE: DOUBLE_QUOTE_STRING | SINGLE_QUOTE_STRING;
ATTR_WHITESPACE: [ \t\r\n] -> channel(HIDDEN);
ATTR_TAG_SLASH: '/';
ATTR_TAG_CLOSE: '>' -> popMode,popMode; // double popMode to DEFAULT
ATTR_TAG_SLASH_CLOSE: '/' [ \t]* '>' -> popMode,popMode; // double popMode to DEFAULT

fragment DOUBLE_QUOTE_STRING: '"' (ESCAPE | ~'"')* '"';
fragment SINGLE_QUOTE_STRING: '\'' (ESCAPE | ~'\'')* '\'';
fragment ESCAPE : '\\"' | '\\\\' | '\\\'';
fragment HEXDIGIT: [a-fA-F0-9];

fragment DIGIT: [0-9];
fragment TAG_NameStartChar: [_$a-zA-Z] | '-';
fragment TAG_NameChar: TAG_NameStartChar | DIGIT;
fragment ATTR_NameStartChar: TAG_NameStartChar;
fragment ATTR_NameChar: ATTR_NameStartChar | DIGIT | ':' | '.' | '|' | ',';
