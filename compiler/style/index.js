const postcss = require('postcss');
const parser = require('postcss-selector-parser');
const prettify = require('postcss-prettify');
const CleanCSS = require('clean-css');

const plugin = postcss.plugin('postcss-jinge-component-style', () => {
  // Work with options here
  return function (root, result) {
    // Transform each rule here
    const styleId = result.opts.styleId;
    function transform(root) {
      root.each(selector => {
        selector.each(n => {
          if (n.type === 'class' || n.type === 'id' || n.type === 'class' || n.type === 'tag') {
            selector.insertAfter(n, parser.attribute({
              attribute: styleId
            }));
          } else if ((n.type === 'combinator' && n.value === '/deep/')
            || (n.type === 'pseudo' && n.value === '::deep')
          ) {
            selector.insertAfter(n, parser.string({value: ' '}));
            selector.removeChild(n);
            return false;
          }
        });
      });
    }
    root.walkRules(rule => {
      rule.selector = parser(transform)
        .processSync(rule.selector, {
          updateSelector: true
        });
    });
  };
});

class CSSParser {
  static parse(code, opts) {
    const styleId = opts.componentStyleStore.styles.get(opts.resourcePath).styleId;
    const plugins = [plugin];
    if (!opts.isProduction) {
      plugins.push(prettify);
    }
    return postcss(plugins).process(code, {
      from: opts.resourcePath,
      styleId
    }).then(result => {
      let css = result.css;
      if (css && opts.isProduction) {
        css = new CleanCSS().minify(css).styles;
      }
      return {
        code: `export default ${JSON.stringify({
          css,
          id: styleId
        })};`
      };
    });
  }
}

module.exports = {
  CSSParser
};
