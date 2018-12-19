parser grammar AttrParser;

options {
  tokenVocab = AttrLexer;
}

value: (TEXT{this._results.push([0, $TEXT.text])} | expr{this._results.push([1, $expr.text])})+;
expr: (EXPR_START | TPL_EXPR_START) (EXPR_SEG | tplStr)* EXPR_END;
tplStr: TPL_STR_START (TPL_STR_TEXT | expr)* TPL_STR_END;