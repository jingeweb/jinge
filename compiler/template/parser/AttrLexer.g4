lexer grammar AttrLexer;

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

fragment DOUBLE_QUOTE_STRING: '"' (ESCAPE | ~'"')* '"';
fragment SINGLE_QUOTE_STRING: '\'' (ESCAPE | ~'\'')* '\'';
fragment ESCAPE : '\\"' | '\\\\' | '\\\'';