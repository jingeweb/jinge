const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

function getUniquePostfix() {
  return '_' + crypto.randomBytes(6).toString('hex');
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
    tpl = tpl.replace(new RegExp('\\$' + k + '\\$', 'g'), ctx[k]);
  }
  return tpl;
}

const SPS = ['', ' ', '  ', '   ', '    ', '     ', '      '];
function prependTab(str, replaceStartEndEmpty = false, spaceCount = 2) {
  if (str.length === 0 || spaceCount === 0) return str;
  if (replaceStartEndEmpty) str = str.replace(/^(\s*\n)+/, '').replace(/(\n\s*)+$/, '');
  const spaces = spaceCount < SPS.length ? SPS[spaceCount] : ''.padStart(spaceCount, ' ');
  if (str[0] !== '\n') str = spaces + str;
  str = str.replace(/\n\s*\n/g, '\n').replace(/\n\s*[^\s]/g, m => '\n' + spaces + m.substring(1));
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
    return obj.map(v => deepClone(v));
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

const jingeRoot = path.resolve(__dirname, '../');

function getJingeBase(resourcePath) {
  return resourcePath.startsWith(jingeRoot) ? path.relative(
    path.dirname(resourcePath),
    jingeRoot
  ) : 'jinge';
}

module.exports = {
  getUniquePostfix,
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
  attrN: convertAttributeName
};
