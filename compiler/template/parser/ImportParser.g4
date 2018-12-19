parser grammar ImportParser;

options {
  tokenVocab = ImportLexer;
}

stmts: (imp{this.__jingeImports.push($imp.text)} | use)*;

imp: IMPORT (local | alias) FROM SOURCE;
use: IMPORT local;

alias: LP expr (COMMA expr)* RP;

expr:  local | (ID AS local);
local: ID {this.__jingeLocals.push($ID)};