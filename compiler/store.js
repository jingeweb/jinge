let INC = 0;
module.exports = {
  genId() {
    return '_jgsty_' + (INC++).toString(32);
  },
  options: null,
  components: new Map(),
  templates: new Map(),
  styles: new Map(),
  extractStyles: new Map(),
  extractComponentStyles: new Map()
};
