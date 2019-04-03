let INC = 0;

module.exports = {
  genId() {
    return '_jgsty_' + (INC++).toString(32);
  },
  components: new Map(),
  templates: new Map(),
  styles: new Map()
};

