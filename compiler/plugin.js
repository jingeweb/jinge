const path = require('path');
const CleanCSS = require('clean-css');
// const VirtualModulePlugin = require('virtual-module-webpack-plugin');
const store = require('./store');
const i18nManager = require('./i18n');
const {
  // jingeRoot,
  isObject,
  isUndefined
} = require('./util');

const PLUGIN_NAME = 'JINGE_EXTRACT_PLUGIN';

function checkCompressOption(webpackOptions) {
  const optimization = webpackOptions.optimization;
  let needComporess = webpackOptions.mode === 'production';
  if (isObject(optimization) && !isUndefined(optimization.minimize)) {
    needComporess = !!optimization.minimize;
  }
  return needComporess;
}

class JingeWebpackPlugin {
  constructor(options = {}) {
    this.options = options;
    this.vmPlugin = null;
  }

  _prepareOptions(webpackOptions) {
    const options = this.options;
    options.compress = checkCompressOption(webpackOptions);

    const i18nOptions = options.i18n;
    if (i18nOptions) {
      if (!i18nOptions.defaultLocale) {
        throw new Error('JingeWebpackPlugin: i18n options require "defaultLocale" property.');
      }
      if (!i18nOptions.filename) {
        i18nOptions.filename = 'locale.[locale].js';
      }
      options.i18n = Object.assign({
        idBaseDir: process.cwd(),
        translateDir: path.join(process.cwd(), 'translate')
      }, i18nOptions);
    }

    const styleOptions = options.style;
    if (!styleOptions) {
      options.style = {
        extract: false
      };
    } else {
      if (!styleOptions.filename) {
        styleOptions.filename = `bundle${options.compress ? '.min' : ''}.css`;
      }
      options.style = Object.assign({}, {
        extract: true,
        keepComment: false
      }, styleOptions);
    }
  }

  async writeExtractStyle(assets) {
    const opts = this.options.style;
    if (!opts.extract) {
      return;
    }
    let output = `.jg-hide {
  display: none !important;
}

.jg-hide.jg-hide-enter,
.jg-hide.jg-hide-leave {
  display: block !important;
}\n`;
    store.extractStyles.forEach(info => {
      output += info.code || '';
    });
    store.extractComponentStyles.forEach(info => {
      output += info.css || '';
    });
    output = output.replace(/@charset "UTF-8";/g, '');
    // TODO: generate soure map
    if (this.options.compress) {
      output = new CleanCSS().minify(output).styles;
    }
    assets[opts.filename] = {
      source: () => output,
      size: () => output.length
    };
  }

  apply(compiler) {
    this._prepareOptions(compiler.options);

    store.options = this.options;

    if (this.options.i18n) {
      i18nManager.initialize(this.options.i18n);
      // this.vmPlugin = new VirtualModulePlugin({
      //   path: i18nManager.depFns.file,
      //   contents: i18nManager.depFns.contents
      // });
      // this.vmPlugin.apply(compiler);
      // compiler.hooks.compilation.tap(PLUGIN_NAME, compilation => {
      // compilation.hooks.finishModules.tap(PLUGIN_NAME, modules => {
      //   if (i18nManager.written || i18nManager.renderDeps.arr.length === 0) {
      //     return;
      //   }

      //   let sourceMode = false;
      //   let i18nDepsMod = null;
      //   for (let i = 0; i < modules.length; i++) {
      //     const mod = modules[i];
      //     if (!sourceMode && mod.resource === jingeRoot) {
      //       sourceMode = true;
      //     }
      //     if (i18nDepsMod === null && mod.resource === i18nManager.depFns.file) {
      //       i18nDepsMod = mod;
      //     }
      //     if (sourceMode && i18nDepsMod) {
      //       break;
      //     }
      //   }
      //   if (!i18nDepsMod) {
      //     return;
      //   }
      //   const src = i18nDepsMod._source;
      //   i18nManager.depFns.contents = src._value + `\n\nif (!__i18n[__I18N_RENDER_DEPS]) __i18n[__I18N_RENDER_DEPS] = {\n  render: [${
      //     [...i18nManager.depFns.render.keys()].map(k => `__${k}`).join(', ')
      //   }],\n  attribute: [${
      //     [...i18nManager.depFns.attribute.keys()].map(k => `__${k}`).join(', ')
      //   }]\n};`;
      //   src._value = i18nManager.depFns.contents;
      // });
      // });
    }

    compiler.hooks.emit.tapAsync(PLUGIN_NAME, (compilation, callback) => {
      Promise.all([
        this.writeExtractStyle(compilation.assets),
        i18nManager.writeOutput(compilation.assets)
      ]).catch(error => {
        console.error(error);
      }).then(() => {
        callback();
      });
    });
  }
}

module.exports = {
  checkCompressOption,
  JingeWebpackPlugin
};
