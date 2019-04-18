const store = require('./_store');
const fs = require('fs').promises;
const path = require('path');
const CleanCSS = require('clean-css');

async function mkdir(dirname) {
  try {
    await fs.access(dirname);
    return;
  } catch(err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
  await mkdir(path.dirname(dirname));
  await fs.mkdir(dirname);
}

class JingeWebpackPlugin {
  constructor(options = {}) {
    this.i18nOptions = options.i18n || {};
    this.styleOptions = options.style || {};
  }
  async _genStyle(outputDir, compress) {
    let output = '';
    store.extractStyles.forEach(info => {
      output += info.code;
    });
    store.extractComponentStyles.forEach(info => {
      output += info.css;
    });
    // TODO: generate soure map
    if (compress) {
      output = new CleanCSS().minify(output).styles;
    }
    const file = path.resolve(outputDir, this.styleOptions.filename);
    await mkdir(path.dirname(file));
    await fs.writeFile(
      file,
      output
    );
  }
  async _genTranslate() {
    const opts = this.i18nOptions;
    if (opts.buildLocale !== opts.defaultLocale || opts.generateCSV === false) {
      return;
    }
    const dir = opts.translateDir;
    await mkdir(dir);
    await store.i18n.writeTranslateCSV(dir, opts);
  }
  apply(compiler) {
    const copt = compiler.options;
    const needCompress = ('compress' in this.styleOptions) ? !!this.styleOptions.compress : copt.mode === 'production';
    const outputDir = (copt.output ? copt.output.path : null) || process.cwd();
    compiler.hooks.emit.tapAsync('JINGE_EXTRACT_PLUGIN', (compilation, callback) => {
      Promise.all([
        store.extractStyles.size > 0 || store.extractComponentStyles.size > 0 ? this._genStyle(outputDir, needCompress) : Promise.resolve(),
        store.i18n.size > 0 ? this._genTranslate() : Promise.resolve(),
      ]).catch((error) => {
        compilation.errors.push(error);
      }).then(() => {
        callback();
      });
    });
  }
}

module.exports = {
  JingeWebpackPlugin
};
