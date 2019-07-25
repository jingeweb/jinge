const store = require('./_store');
const fs = require('fs').promises;
const path = require('path');
const CleanCSS = require('clean-css');

async function mkdir(dirname) {
  try {
    await fs.access(dirname);
    return;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
  await mkdir(path.dirname(dirname));
  await fs.mkdir(dirname);
}

class JingeWebpackPlugin {
  constructor(options = {}) {
    this.options = options;
  }

  async _genStyle(outputDir, compress) {
    const opts = this.options.extractStyle;
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
    if (compress) {
      output = new CleanCSS().minify(output).styles;
    }
    const file = path.resolve(outputDir, opts.filename);
    await mkdir(path.dirname(file));
    await fs.writeFile(
      file,
      output
    );
  }

  async _genTranslate() {
    const opts = this.options.i18n || {};
    if (opts.buildLocale !== opts.defaultLocale || opts.generateCSV === false) {
      return;
    }
    const dir = opts.translateDir;
    await mkdir(dir);
    await store.i18n.writeTranslateCSV(dir, opts);
  }

  apply(compiler) {
    const copt = compiler.options;
    const popt = this.options;
    const needCompress = ('compress' in popt) ? !!popt.compress : copt.mode === 'production';
    const outputDir = (copt.output ? copt.output.path : null) || process.cwd();
    compiler.hooks.emit.tapAsync('JINGE_EXTRACT_PLUGIN', (compilation, callback) => {
      Promise.all([
        popt.extractStyle ? this._genStyle(outputDir, needCompress) : Promise.resolve(),
        store.i18n.size > 0 ? this._genTranslate() : Promise.resolve()
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
