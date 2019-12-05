const postcss = require('postcss');
const parser = require('postcss-selector-parser');
const discard = require('postcss-discard-comments');
const prettify = require('postcss-prettify');
const CleanCSS = require('clean-css');
const store = require('./store');

function checkKeyframes(nodes, styleId, keyframesMap = null) {
  nodes.forEach(node => {
    if (node.type === 'atrule' && node.name === 'keyframes') {
      const name = node.params;
      if (name.startsWith('/deep/')) {
        node.params = name.replace(/\/deep\/\s*/, '');
        return;
      }
      if (!keyframesMap) {
        keyframesMap = new Map();
      }
      if (!keyframesMap.has(name)) {
        node.params = `${name}_${styleId}`;
        keyframesMap.set(name, node.params);
      }
    } else if (node.type === 'atrule' && node.name === 'media') {
      keyframesMap = checkKeyframes(node.nodes, styleId, keyframesMap);
    }
  });
  return keyframesMap;
}

function parseKeyframes(root, styleId) {
  const keyframesMap = checkKeyframes(root.nodes, styleId);
  if (!keyframesMap || keyframesMap.size === 0) {
    return;
  }
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

function parseNodes(nodes, styleId) {
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

  nodes.forEach(node => {
    if (node.type === 'atrule' && node.name === 'media') {
      return parseNodes(node.nodes, styleId);
    }
    if (node.type !== 'rule') {
      return;
    }
    node.selector = parser(transform)
      .processSync(node.selector, {
        updateSelector: true
      });
  });
}

const plugin = postcss.plugin('postcss-jinge-component-style', () => {
  return function(root, result) {
    const styleId = result.opts.styleId;
    parseKeyframes(root, styleId);
    parseNodes(root.nodes, styleId);
  };
});

class CSSParser {
  static parse(code, sourceMap, opts) {
    const needExtract = store.options.style.extract;
    const extractInfo = store.extractStyles.get(opts.resourcePath);
    if (extractInfo) {
      const plugs = [discard, prettify];
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
    const styleId = store.styles.get(opts.resourcePath).styleId;
    // console.log(opts.resourcePath, styleId);
    const plugins = [plugin, discard];
    if (!store.options.compress) {
      plugins.push(prettify);
    }
    return postcss(plugins).process(code, {
      from: opts.resourcePath,
      styleId,
      map: sourceMap ? {
        inline: !needExtract,
        prev: sourceMap
      } : false
    }).then(result => {
      let css = result.css;
      let map = result.map;
      if (css && store.options.compress) {
        css = new CleanCSS().minify(css).styles;
        // TODO: generate map
        map = null;
      }
      if (needExtract) {
        css = `\n/* ${opts.resourcePath} */\n` + css;
        const ecs = store.extractComponentStyles.get(opts.resourcePath);
        if (!ecs) {
          store.extractComponentStyles.set(opts.resourcePath, {
            css, map
          });
        } else {
          ecs.css = css;
          ecs.map = map;
        }
      }
      return {
        code: needExtract ? `export default null; // ${styleId} is extracted by JingeWebpackPlugin at ${new Date().toLocaleString()}` : `export default ${JSON.stringify({
          css,
          id: styleId
        })};`
      };
    });
  }

  static parseInline(code, opts) {
    const needExtract = store.options.style.extract;
    const plugins = [plugin, discard];
    if (!store.options.compress) {
      plugins.push(prettify);
    }
    let css = postcss(plugins).process(code, {
      from: opts.resourcePath,
      styleId: opts.styleId,
      map: false
    }).css;

    if (css && store.options.compress) {
      css = new CleanCSS().minify(css).styles;
    }
    if (needExtract) {
      css = `\n/* ${opts.resourcePath} */\n` + css;
      const ecsMap = store.extractComponentStyles;
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
      code: needExtract ? `null; // ${opts.styleId} is extracted by JingeWebpackPlugin at ${new Date().toLocaleString()}` : `${JSON.stringify({
        css,
        id: opts.styleId
      })};`
    };
  }
}

module.exports = {
  CSSParser
};
