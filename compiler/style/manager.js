const CleanCSS = require('clean-css');
const crypto = require('crypto');
const { sharedOptions } = require('../options');

class StyleManager {
  constructor() {
    this.components = new Map();
    this.templates = new Map();
    this.styles = new Map();
    /**
     * 被 import 但没有被关联为 component style 的样式，或称为全局样式。
     */
    this.extractStyles = new Map();
    /**
     * 被 import 且关联为 component style 的样式。
     */
    this.extractComponentStyles = new Map();
    this.outputCache = new Map();
    this.chunkTags = null;
    /**
     * 存储最终的 webpackChunkName 到生成的 css 文件名的映射。
     */
    this.outputChunks = new Map();
  }
  initialize() {
    // nothing to do.
  }
  handleMultiChunk(compilation) {
    if (!sharedOptions.multiChunk) return;
    this.chunkTags = new Map();
    compilation.chunks.forEach((chunk) => {
      const tag = new Set();
      chunk._modules.forEach(mod => {
        tag.add(mod.resource);
      });
      this.chunkTags.set(chunk, tag);
    });
  }
  writeOutput(compilation) {
    if (!sharedOptions.style.extract) {
      return;
    }
    const { assets } = compilation;
    const entryChunks = compilation.chunks.filter(chunk => chunk.entryModule);
    if (entryChunks.length === 0) {
      throw new Error('Entry chunk not found!');
    }
    if (entryChunks.length > 1) {
      throw new Error('This version do not support multiply entries.');
    }

    if (!sharedOptions.multiChunk) {
      if (compilation.chunks.length > 1) {
        throw new Error('must set multiChunk = true if use webpack code splitting multi-chunk');
      }
      const filename = entryChunks[0].files.find(f => f.endsWith('.js'));
      let output = '';
      /**
       * 将没有被关联为 component style 的样式（全局样式）放在前面，
       * 因为这种样式有全局的含义。
       */
      this.extractStyles.forEach(info => {
        output += info.css || '';
      });
      /**
       * 将 component style 放在后面。
       */
      this.extractComponentStyles.forEach(info => {
        output += info.css || '';
      });
      this.writeMergedStyle({
        name: 'main',
        isEntry: true,
        isEmpty: false,
        filename,
        finalFilename: ''
      }, output, compilation.assets);
      return;
    }

    this.outputChunks.clear();
    const chunks = compilation.chunks.slice(0);
    const idx = chunks.indexOf(entryChunks[0]);
    // 把 entry 所在的 chunk 移到最前面。
    if (idx !== 0) {
      chunks.unshift(chunks.splice(idx, 1)[0]);
    }
    const ss1 = new Map(this.extractStyles);
    const ss2 = new Map(this.extractComponentStyles);
    chunks.forEach((chunk, i) => {
      const tag = this.chunkTags.get(chunk);
      let output = '';
      /**
       * 将没有被关联为 component style 的样式（全局样式）放在前面，
       * 因为这种样式有全局的含义。将 component style 放在全局样式的后面。
       */
      [ss1, ss2].forEach(ss => {
        if (ss.size === 0 || tag.size === 0) return;
        tag.forEach(moduleResource => {
          let r = ss.get(moduleResource);
          if (!r) return;
          output += r.css;
          if (i === 0) {
            // 在 entry chunk 中出现过的 style，不需要在 sub chunk 中重复。
            // 但如果不同的 sub chunk 有交集，当前版本会有重复。
            ss1.set(moduleResource, null);
          }
        });
      });
      const chunkInfo = {
        name: chunk.name || chunk.id.toString(),
        /**
         * 当前版本限定了 webpackChunkName 必须满足 /^\w[\w\d_$]*$/，
         * 因此不可能出现 ~ 符号。如果出现 ~ 符号，则是当前版本的 webpack 抽取出来的公共 chunk。 
         */
        isCommon: (chunk.name || chunk.id.toString()).indexOf('~') >= 0,
        isEntry: i === 0,
        isEmpty: false,
        filename: chunk.files.find(f => f.endsWith('.js')),
        finalFilename: '',
        deps: []
      }
      this.outputChunks.set(chunkInfo.name, chunkInfo);
      if (!chunkInfo.isCommon) {
        // 非公共 chunk 才需要输出到依赖字典。
        chunk._groups.forEach(chunkGroup => {
          chunkGroup.chunks.forEach(depChunk => {
            if (depChunk === chunk) return;
            chunkInfo.deps.push(depChunk.name || depChunk.id.toString());
          });
        });
      }
      this.writeMergedStyle(chunkInfo, output, compilation.assets);
    });
  }
  writeMergedStyle(chunkInfo, output, assets) {
    if (chunkInfo.isEntry) output = `.jg-hide {
  display: none !important;
}

.jg-hide.jg-hide-enter,
.jg-hide.jg-hide-leave {
  display: block !important;
}\n` + output;
    
    output = output.replace(/@charset "UTF-8";/g, '').trim();

    if (!chunkInfo.isEntry && !output) {
      chunkInfo.isEmpty = true;
      return;
    }

    // TODO: generate soure map
    if (sharedOptions.compress) {
      output = new CleanCSS().minify(output).styles;
    }

    const filename = chunkInfo.filename.replace(/\.js$/, '.css').replace(/[a-z0-9]{20}/, m => {
      return crypto.createHash('sha256').update(output).digest('hex').substr(0, 20);
    });
    chunkInfo.finalFilename = filename;

    if (this.outputCache.get(filename) === output) {
      // 如果在 watch 模式下，文件内容没有变化，不需要输出 asset。
      return;
    }
    this.outputCache.set(filename, output);
    assets[filename] = {
      source: () => output,
      size: () => output.length
    };
  }
}

module.exports = {
  styleManager: new StyleManager()
};
