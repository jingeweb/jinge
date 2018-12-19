lexer grammar ImportLexer;

IMPORT: 'import';
SPACE: [ \t\r\n]+ -> channel(HIDDEN);
FROM: 'from';
AS: 'as';
LP: '{';
RP: '}';
COMMA: ',';
ID: CHAR+;
SOURCE: DOUBLE_QUOTE_STRING | SINGLE_QUOTE_STRING;
COMMENT: (INLINE_COMMENT | BLOCK_COMMENT) -> skip;
OTHER: . -> skip;

fragment CHAR : [a-zA-Z_$];
fragment INLINE_COMMENT: '//' ~[\n]*;
fragment BLOCK_COMMENT: '/*' .*? '*/';
fragment DOUBLE_QUOTE_STRING: '"' ~["]* '"';
fragment SINGLE_QUOTE_STRING: '\'' ~[']* '\'';