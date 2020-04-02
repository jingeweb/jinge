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

module.exports = {
  sharedOptions,
  checkCompressOption
};
