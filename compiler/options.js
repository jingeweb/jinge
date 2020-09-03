const {
  isObject,
  isUndefined
} = require('./util');

const sharedOptions = {};

function checkCompressOption(webpackOptions) {
  const optimization = webpackOptions.optimization;
  let needComporess = webpackOptions.mode === 'production';
  if (isObject(optimization) && !isUndefined(optimization.minimize)) {
    needComporess = !!optimization.minimize;
  }
  return needComporess;
}

function getWebpackVersion(compiler) {
  // 暂时用不怎么靠谱的方式来判别 webpack 的版本号。
  return 'root' in compiler ? 5 : 4;
}

module.exports = {
  sharedOptions,
  getWebpackVersion,
  checkCompressOption
};
