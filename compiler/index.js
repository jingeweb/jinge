const { ComponentParser } = require('./parser');
const { TemplateParser } = require('./template');

/* webpack config loader only accept String. */
const jingeLoader = require('path').resolve(__dirname, './loader.js');

module.exports = {
  ComponentParser,
  TemplateParser,
  jingeLoader
};
