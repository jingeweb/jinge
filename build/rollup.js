const path = require('path');
const rollup = require('rollup');
const banner = require('rollup-plugin-banner').default;
const resolve = require('rollup-plugin-node-resolve');
const {
  terser
} = require('rollup-plugin-terser');

const {
  jingeBuildSelfPlugin
} = require('./rollup-plugin');

const needComporess = 'COMPRESS' in process.env;
const plugins = [
  resolve({
    extensions: ['.js']
  }),
  jingeBuildSelfPlugin({
    compress: needComporess,
    jingeRoot: path.resolve(__dirname, '../'),
    innerComponentsDir: path.resolve(__dirname, '../components')
  })
];

if (needComporess) {
  plugins.push(terser());
}

plugins.push(banner(`jinge mvvm framework
@version: <%= pkg.version %>
@copyright: 2019 <%= pkg.author %>
@license: MIT`));

(async function() {
  const bundle = await rollup.rollup({
    plugins,
    input: path.resolve(__dirname, '../index.js')
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
