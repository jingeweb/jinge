const path = require('path');
const rollup = require('rollup');
const banner = require('rollup-plugin-banner').default;
const resolve = require('rollup-plugin-node-resolve');
const { terser } = require('rollup-plugin-terser');
const jingePlugin = require('../compiler/rollup-plugin');

const needComporess = 'COMPRESS' in process.env;
const plugins = [
  resolve({
    extensions: ['.js']
  }),
  jingePlugin({
    compress: needComporess
  })
];

if (needComporess) {
  plugins.push(terser());
}

plugins.push(banner(`mvvm framework for https://jinge.design
@version: <%= pkg.version %>
@copyright: 2020 <%= pkg.author %>
@license: MIT`));

(async function() {
  const bundle = await rollup.rollup({
    plugins,
    input: path.resolve(__dirname, '../lib/index.js')
  });
  const {
    output
  } = await bundle.write({
    file: path.resolve(__dirname, `../dist/jinge${needComporess ? '.min' : ''}.js`),
    format: 'umd',
    name: 'jinge'
  });
  console.log(output[0].fileName, 'generated.');
})().catch(err => {
  console.error(err.stack);
});
