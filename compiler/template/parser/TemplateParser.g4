parser grammar TemplateParser;

options {
  tokenVocab = TemplateLexer;
}

html: htmlNode+;

htmlNode: htmlComment | htmlElement | htmlTextContent;

htmlComment: COMMENT;

htmlElement
  : TAG_OPEN htmlStartTag htmlAttribute* ATTR_TAG_CLOSE htmlNode* TAG_OPEN TAG_SLASH htmlEndTag ATTR_TAG_CLOSE
  | TAG_OPEN htmlStartTag htmlAttribute* ATTR_TAG_SLASH_CLOSE
  ;

htmlTextContent: (htmlText | htmlExpr)+;
htmlText: TEXT;
htmlExpr: (EXPR_START | TPL_EXPR_START) (EXPR_SEG | htmlTplStr)* EXPR_END;
htmlTplStr: TPL_STR_START (TPL_STR_TEXT | htmlExpr)* TPL_STR_END;

htmlStartTag: TAG_NAME;
htmlEndTag: TAG_NAME;

htmlAttribute: ATTR_NAME ATTR_EQUAL ATTR_VALUE | ATTR_NAME;
