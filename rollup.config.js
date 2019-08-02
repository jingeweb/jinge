/* eslint-env node */

import banner from 'rollup-plugin-banner';

const path = require('path');
const {
  terser
} = require('rollup-plugin-terser');
const resolve = require('rollup-plugin-node-resolve');
const {
  jingeBuildSelfPlugin
} = require('./compiler/_rollup');

const needComporess = 'COMPRESS' in process.env;
const plugins = [
  resolve(),
  jingeBuildSelfPlugin({
    jingeRoot: __dirname,
    innerComponentsDir: path.join(__dirname, 'components')
  })
];
if (needComporess) {
  plugins.push(terser());
}

plugins.push(banner(`jinge mvvm framework
@version: <%= pkg.version %>
@copyright: 2019 <%= pkg.author %>
@license: MIT`));

module.exports = {
  plugins,
  input: './index.js',
  output: {
    file: `./dist/jinge${needComporess ? '.min' : ''}.js`,
    format: 'umd',
    name: 'jinge'
  }
};
