const path = require('path');

class ComponentBaseManager {
  constructor() {
    this.componentBase = null;
    this.componentBaseLocals = new Map();
  }

  initialize(componentBase) {
    const defaultBase = {
      Component: [
        path.resolve(__dirname, '../../lib/index.js'),
        path.resolve(__dirname, '../../lib/core/component.js'),
        path.resolve(__dirname, '../../lib/core/index.js'),
      ],
    };
    if (Array.isArray(componentBase)) {
      componentBase = Object.assign({}, ...componentBase);
    } else if (!componentBase) {
      componentBase = {};
    }
    for (const n in componentBase) {
      const v = Array.isArray(componentBase[n]) ? componentBase[n] : [componentBase[n]];
      if (n in defaultBase) {
        defaultBase[n] = defaultBase[n].concat(v);
      } else {
        defaultBase[n] = v;
      }
    }
    this.componentBase = defaultBase;
  }
}

module.exports = new ComponentBaseManager();
