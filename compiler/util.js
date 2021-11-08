const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

let cachedSymbolPostfix;
function getSymbolPostfix() {
  if (cachedSymbolPostfix) {
    return cachedSymbolPostfix;
  }
  const buf = crypto
    .createHash('sha256')
    .update('jinge-mvvm-framework-by-yuhangge-https://github.com/jinge-design/jinge');
  cachedSymbolPostfix = '_' + buf.digest('hex').substr(0, 12);
  return cachedSymbolPostfix;
}

function isString(v) {
  return typeof v === 'string';
}

function isObject(v) {
  return typeof v === 'object' && v !== null;
}

function isFunction(v) {
  return typeof v === 'function';
}

function isUndefined(v) {
  return typeof v === 'undefined';
}

function isNull(v) {
  return v === null;
}

function isNumber(v) {
  return typeof v === 'number';
}

function isRegExp(v) {
  return v && v instanceof RegExp;
}

function isArray(v) {
  return v && Array.isArray(v);
}

function arrayIsEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}

function isBoolean(v) {
  return typeof v === 'boolean' || v instanceof Boolean;
}

function isSimpleProp(p) {
  return isString(p) && /^[\w\d$_]+$/.test(p);
}

function isSimpleType(v) {
  return isUndefined(v) || isNull(v) || isString(v) || isNumber(v) || isBoolean(v) || isRegExp(v);
}

function replaceTplStr(tpl, ctx) {
  for (const k in ctx) {
    tpl = tpl.replace(new RegExp('\\$' + k + '\\$', 'g'), ctx[k].replace(/\$/g, '$$$$'));
  }
  return tpl;
}

const SPS = ['', ' ', '  ', '   ', '    ', '     ', '      '];
function prependTab(str, replaceStartEndEmpty = false, spaceCount = 2) {
  if (str.length === 0 || spaceCount === 0) return str;
  if (replaceStartEndEmpty) str = str.replace(/^(\s*\n)+/, '').replace(/(\n\s*)+$/, '');
  const spaces = spaceCount < SPS.length ? SPS[spaceCount] : ''.padStart(spaceCount, ' ');
  if (str[0] !== '\n') str = spaces + str;
  str = str.replace(/\n\s*\n/g, '\n').replace(/\n\s*[^\s]/g, (m) => '\n' + spaces + m.substring(1));
  return str;
}

function convertAttributeName(an) {
  return (an.startsWith('[') && an.endsWith(']')) || /^[\w\d$_]+$/.test(an) ? an : JSON.stringify(an);
}

async function mkdirp(dirname) {
  try {
    await fs.access(dirname);
    return;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
  await mkdirp(path.dirname(dirname));
  await fs.mkdir(dirname);
}

function deepClone(obj) {
  if (isArray(obj)) {
    return obj.map((v) => deepClone(v));
  } else if (obj instanceof Map) {
    const nm = new Map();
    obj.forEach((v, k) => {
      nm.set(k, deepClone(v));
    });
    return nm;
  } else if (isObject(obj)) {
    const no = {};
    for (const k in obj) {
      no[k] = deepClone(obj[k]);
    }
    return no;
  } else {
    return obj;
  }
}

const jingeRoot = path.resolve(__dirname, '../lib');

function getJingeBase(resourcePath) {
  return resourcePath.startsWith(jingeRoot) ? path.relative(path.dirname(resourcePath), jingeRoot) : 'jinge';
}

const RIX = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$_ ~!@#%^&*()+=-`[]|}{;'<,.>/?";

class KeyGenerator {
  constructor(rix = RIX, sep = ':') {
    if (rix.indexOf(sep) >= 0) {
      throw new Error('invalid char');
    }
    if (new Set(rix).size !== rix.length) {
      throw new Error('duplicate char');
    }
    this._cache = new Map();
    this._rix = rix;
    this._sep = sep;
  }
  _hash32_b(text) {
    const buf = new TextEncoder().encode(text);
    let h = 9;
    for (let i = 0; i < buf.length; i++) {
      h = Math.imul(h ^ buf[i], 9 ** 9);
    }
    return (h ^ (h >>> 9)) >>> 0;
  }
  _hash32(text) {
    const buf = new TextEncoder().encode(text);
    let hash = 0;
    for (let i = 0; i < buf.length; i++) {
      hash = ((hash << 5) - hash + buf[i]) | 0; // Convert to 32bit integer
    }
    return hash >>> 0; // convert to usinged 32 bit integer
  }
  num2str(n) {
    let result = '';
    while (n > 0) {
      const rixit = n % this._rix.length;
      result = this._rix.charAt(rixit) + result;
      n = Math.floor(n / this._rix.length);
      // if (n === 0) break;
    }
    return result;
  }
  generate(text) {
    /**
     * 此处需要将 text 哈希成 4 bytes 整数。到底是直接用 sha256 然后取前 4 bytes 更好，
     * 还是用其它的算法更好，不是很确定。。。
     * https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
     */
    // const buf = crypto.createHash('sha256').update(text).digest();
    const n = this._hash32_b(text); // buf.readUInt32LE();
    if (this._cache.has(n)) {
      const c = this._cache.get(n) + 1;
      this._cache.set(n, c);
      return this.num2str(n) + this._sep + this.num2str(c);
    } else {
      this._cache.set(n, 0);
      return this.num2str(n);
    }
  }
}

/**
 * 判断给定的 chunk 是否是 webpack 自动抽取的被共用的代码的公共 chunk。
 * 用于 webpack 4 及以下版本。且必须限制 chunk 的名称本身不能出现 ~ 符号。
 * @param {Chunk} chunk
 */
function isCommonChunk_v4(chunk) {
  /**
   * 当前版本限定了 webpackChunkName 必须满足 /^\w[\w\d_$]*$/，
   * 因此不可能出现 ~ 符号。如果出现 ~ 符号，则是当前版本的 webpack 抽取出来的公共 chunk。
   */
  return (chunk.name || chunk.id.toString()).indexOf('~') >= 0;
}

const reasons = new Set(['split chunk (cache group: default)', 'split chunk (cache group: defaultVendors)']);
/**
 * 判断给定的 chunk 是否是 webpack 自动抽取的被共用的代码的公共 chunk。
 * 用于 webpack 5 及以上版本。
 * @param {Chunk} chunk
 */
function isCommonChunk_v5(chunk) {
  /**
   * 目前的逻辑通过 chunkReason 是否为空来判断某个 chunk 是否是 webpack 内部提取出来的公共（common）复用 chunk。
   * 从 webpack 源码来看，似乎只要 chunkReason 不为空都是公共 chunk，但不同的内部 plugin 生成的 chunkReason 各有不同，
   * 只有 "split chunk (cache group: default)" 这个是目前测试遇到了可以确认处理逻辑无误的。
   *
   * 对于其它 chunkReason，暂时以告警的形式打印。实际遇到的时候再来确认下是否逻辑无误。
   */
  if (chunk.chunkReason && !reasons.has(chunk.chunkReason)) {
    reasons.add(chunk.chunkReason);
    // eslint-disable-next-line no-console
    console.warn(`WARNING: unknown chunk reason "${chunk.chunkReason}" of chunk "${chunk.name || chunk.id}"`);
  }
  return !!chunk.chunkReason;
}

module.exports = {
  getSymbolPostfix,
  jingeRoot,
  getJingeBase,
  mkdirp,
  deepClone,
  isSimpleType,
  isString,
  isObject,
  isFunction,
  isSimpleProp,
  isUndefined,
  isNull,
  isNumber,
  isRegExp,
  isArray,
  arrayIsEqual,
  isBoolean,
  replaceTplStr,
  prependTab,
  KeyGenerator,
  attrN: convertAttributeName,
  isCommonChunk_v5,
  isCommonChunk_v4,
};
