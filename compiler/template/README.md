# template parser for jinge-compiler

## Develop

Use [vscode-antlr4](https://github.com/mike-lischke/vscode-antlr4) plugin to watch `g4` file and generate JavaScript code.

Vscode settings:

````json
"antlr4.generation": {
  "mode": "external",
  "language": "JavaScript",
  "listeners": false,
  "visitors": true
}
````