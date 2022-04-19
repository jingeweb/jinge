/* webpack config loader only accept String. */
const jingeLoader = require('path').resolve(__dirname, './loader.js');

const { ComponentParser } = require('./component');
const { TemplateParser } = require('./template');
const { JingeWebpackPlugin } = require('./plugin');

const jingeRule = {
  test: /\.c\.(js|html)$/,
  use: jingeLoader,
};

module.exports = {
  ComponentParser,
  TemplateParser,
  JingeWebpackPlugin,
  jingeLoader,
  jingeRule,
};
