const postcss = require('postcss');
const parser = require('postcss-selector-parser');
const discard = require('postcss-discard-comments');
const prettify = require('postcss-prettify');
const CleanCSS = require('clean-css');

const plugin = postcss.plugin('postcss-jinge-component-style', () => {
  // Work with options here
  return function(root, result) {
    // Transform each rule here
    const styleId = result.opts.styleId;
    let keyframesMap = null;

    function transform(root) {
      root.each(selector => {
        selector.each(n => {
          if (n.type === 'class' || n.type === 'id' || n.type === 'class' || n.type === 'tag') {
            selector.insertAfter(n, parser.attribute({
              attribute: styleId
            }));
          } else if ((n.type === 'combinator' && n.value === '/deep/') ||
            (n.type === 'pseudo' && n.value === '::deep')
          ) {
            selector.insertAfter(n, parser.string({
              value: ' '
            }));
            selector.removeChild(n);
            return false;
          }
        });
      });
    }

    root.nodes.forEach(node => {
      if (node.type === 'atrule' && node.name === 'keyframes') {
        const name = node.params;
        if (name.startsWith('/deep/')) {
          node.params = name.replace(/\/deep\/\s*/, '');
          return;
        }
        if (!keyframesMap) keyframesMap = new Map();
        if (keyframesMap.has(name)) return;
        node.params = `${name}_${styleId}`;
        keyframesMap.set(name, node.params);
      }
    });
    if (keyframesMap) {
      root.walkDecls(/^animation(?:-name)?$/, decl => {
        let an = decl.value;
        const idx = an.indexOf(' ');
        if (decl.prop === 'animation') {
          an = an.substring(0, idx < 0 ? an.length : idx);
        }
        const kn = keyframesMap.get(an);
        if (!kn) {
          return;
        }
        if (decl.prop === 'animation') {
          decl.value = kn + decl.value.substring(idx);
        } else {
          decl.value = kn;
        }
      });
    }

    root.nodes.forEach(node => {
      if (node.type !== 'rule') {
        return;
      }
      node.selector = parser(transform)
        .processSync(node.selector, {
          updateSelector: true
        });
    });
  };
});

class CSSParser {
  static parse(code, sourceMap, opts) {
    const _store = opts.componentStyleStore;
    const extractInfo = _store.extractStyles.get(opts.resourcePath);
    if (extractInfo) {
      const plugs = [prettify];
      if (!opts.keepStyleComments) {
        plugs.unshift(discard);
      }
      return postcss(plugs).process(code, {
        from: opts.resourcePath,
        map: sourceMap ? {
          inline: false,
          prev: sourceMap
        } : false
      }).then(result => {
        extractInfo.map = result.map;
        extractInfo.code = result.css;
        return {
          code: `export default "Extract by JingeWebpackPlugin at ${new Date().toLocaleString()}";`
        };
      });
    }
    const styleId = _store.styles.get(opts.resourcePath).styleId;
    // console.log(opts.resourcePath, styleId);
    const plugins = [plugin];
    if (!opts.compress) {
      plugins.push(prettify);
    }
    if (opts.extractStyle && !opts.keepStyleComments) {
      plugins.push(discard);
    }
    return postcss(plugins).process(code, {
      from: opts.resourcePath,
      styleId,
      map: sourceMap ? {
        inline: !opts.extractStyle,
        prev: sourceMap
      } : false
    }).then(result => {
      let css = result.css;
      let map = result.map;
      if (css && opts.compress) {
        css = new CleanCSS().minify(css).styles;
        // TODO: generate map
        map = null;
      }
      if (opts.extractStyle) {
        css = `\n/* ${opts.resourcePath} */\n` + css;
        const ecs = _store.extractComponentStyles.get(opts.resourcePath);
        if (!ecs) {
          _store.extractComponentStyles.set(opts.resourcePath, {
            css, map
          });
        } else {
          ecs.css = css;
          ecs.map = map;
        }
      }
      return {
        code: opts.extractStyle ? `export default null; // ${styleId} is extracted by JingeWebpackPlugin at ${new Date().toLocaleString()}` : `export default ${JSON.stringify({
          css,
          id: styleId
        })};`
      };
    });
  }

  static parseInline(code, opts) {
    const plugins = [plugin];
    if (opts.extractStyle && !opts.keepStyleComments) {
      plugins.push(discard);
    }
    if (!opts.compress) {
      plugins.push(prettify);
    }
    let css = postcss(plugins).process(code, {
      from: opts.resourcePath,
      styleId: opts.styleId,
      map: false
    }).css;

    if (css && opts.compress) {
      css = new CleanCSS().minify(css).styles;
    }
    if (opts.extractStyle) {
      css = `\n/* ${opts.resourcePath} */\n` + css;
      const ecsMap = opts.componentStyleStore.extractComponentStyles;
      const ecs = ecsMap.get(opts.resourcePath);
      if (!ecs) {
        ecsMap.set(opts.resourcePath, {
          css
        });
      } else {
        ecs.css = css;
      }
    }
    return {
      code: opts.extractStyle ? `null; // ${opts.styleId} is extracted by JingeWebpackPlugin at ${new Date().toLocaleString()}` : `${JSON.stringify({
        css,
        id: opts.styleId
      })};`
    };
  }
}

module.exports = {
  CSSParser
};
