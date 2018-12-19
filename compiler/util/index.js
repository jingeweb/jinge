/**
 * simple uuid
 */
function uuid() {
  return Date.now().toString(32) + Math.floor(Math.random() * 0xffff).toString(32);
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

function isBoolean(v) {
  return typeof v === 'boolean' || v instanceof Boolean;
}

function isSimpleType(v) {
  return isUndefined(v) || isNull(v) || isString(v) || isNumber(v) || isBoolean(v) || isRegExp(v);
}

function replaceTplStr(tpl, ctx) {
  for(const k in ctx) {
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
module.exports = {
  uuid,
  isSimpleType,
  isString,
  isObject,
  isFunction,
  isUndefined,
  isNull,
  isNumber,
  isRegExp,
  isArray,
  isBoolean,
  replaceTplStr,
  prependTab
};
