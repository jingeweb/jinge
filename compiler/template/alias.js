const crypto = require('crypto');
const { sharedOptions } = require('../options');

function mergeAlias(src, dst) {
  if (src) {
    for (const k in src) {
      if (!src[k] || typeof src[k] !== 'object') throw new Error('bad alias format');
      if (k in dst) {
        Object.assign(dst[k], src[k]);
      } else {
        dst[k] = src[k];
      }
    }
  }
  return dst;
}

class ComponentAliasManager {
  constructor() {
    this.aliasPostfix = '';
    this.alias = {};
    this.localMap = {};
  }

  getComponentOfAlias(etag, imports) {
    if (!(etag in this.alias)) return null;
    const [c, source] = this.alias[etag];
    let arr = imports[source];
    if (!arr) {
      arr = imports[source] = [];
    }
    if (arr.indexOf(c) < 0) {
      arr.push(c);
    }
    return this.localMap[source][c];
  }

  getCode(imports) {
    return Object.keys(imports)
      .map((source) => {
        return `import { ${imports[source]
          .map((c) => `${c} as ${this.localMap[source][c]}`)
          .join(', ')} } from '${source}';`;
      })
      .join('\n');
  }

  initialize(componentAlias) {
    this.aliasPostfix =
      '_' +
      crypto
        .createHmac('sha256', 'component-alias-postfix')
        .update(sharedOptions.symbolPostfix)
        .digest('hex')
        .substr(0, 12);
    if (Array.isArray(componentAlias)) {
      componentAlias = Object.assign({}, ...componentAlias);
    }
    componentAlias = mergeAlias(componentAlias || {}, {
      jinge: {
        LogComponent: 'log',
        I18nComponent: 'i18n',
        IfComponent: 'if',
        ForComponent: 'for',
        SwitchComponent: 'switch',
        HideComponent: 'hide',
        BindHtmlComponent: 'bind-html',
        ToggleClassComponent: 'toggle-class',
        DynamicRenderComponent: 'dynamic',
      },
    });
    for (const source in componentAlias) {
      const m = componentAlias[source];
      if (!this.localMap[source]) {
        this.localMap[source] = {};
      }
      if (source.startsWith('.')) {
        throw new Error('component base source must be absolute path or package under node_modules');
      }
      const hash = crypto.createHash('md5');
      const postfix = '_' + hash.update(source).digest('hex').substr(0, 12) + this.aliasPostfix;
      Object.keys(m).map((c, i) => {
        if (!(c in this.localMap[source])) {
          this.localMap[source][c] = (c === 'default' ? 'Component_default_' + i : c) + postfix;
        }
        const as = Array.isArray(m[c]) ? m[c] : [m[c]];
        as.forEach((a) => {
          this.alias[a] = [c, source];
        });
      });
    }
  }
}

module.exports = {
  aliasManager: new ComponentAliasManager(),
};
