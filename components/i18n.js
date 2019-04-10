
import {
  vmWatch,
  vmUnwatch
} from '../viewmodel/notify';
import {
  Component,
  RENDER,
  ROOT_NODES,
  UPDATE,
  STATE,
  STATE_RENDERED
} from '../core/component';
import { 
  setImmediate,
  clearImmediate
} from '../util';
import {
  createTextNode,
  setText
} from '../dom';
import {
  i18n
} from '../core/i18n';

const I18nComponentsCache = new Map();
export class I18nComponent extends Component {
  static prefix(prefix, cache = true) {
    let C = I18nComponentsCache.get(prefix);
    if (C) return C;
    C = new Function('BaseI18n', `
    return class I18n_${prefix.replace(/\./g, '_')} extends BaseI18n {
      constructor(attrs) {
        const vm = super(attrs);
        this._f = '${prefix}';
        return vm;
      }
    }`)(I18nComponent);
    if (cache) {
      I18nComponentsCache.set(prefix, C);
    }
    return C;
  }
  constructor(attrs) {
    if (!attrs.key) throw new Error('I18n component require attribute "key"');
    super(attrs);
    this._f = ''; // prefix
    this._i = null;  // update immediate
    this.key = attrs.key;
    this.p = attrs.params;

    vmWatch(this, 'p.**', () => {
      this._u();
    });
  }
  beforeDestroy() {
    vmUnwatch(this, 'p.**');
  }
  get key() {
    return this._k;
  }
  set key(v) {
    if (this._k === v) return;
    this._k = v;
    this._u();
  }
  _t() {
    return i18n((this._f ? `${this._f}.` : '') + this.key, this.p);
  }
  _u() {
    if (this[STATE] !== STATE_RENDERED) return;
    if (this._i) clearImmediate(this._i);
    this._i = setImmediate(() => {
      this._i = null;
      this[UPDATE]();
    });
  }
  [RENDER]() {
    const el = createTextNode(this._t());
    this[ROOT_NODES].push(el);
    return this[ROOT_NODES];
  }
  [UPDATE]() {
    const el = this[ROOT_NODES][0];
    setText(el, this._t());
  }
}