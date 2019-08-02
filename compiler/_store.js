const fs = require('fs').promises;
const readFileSync = require('fs').readFileSync;
const path = require('path');
const {
  calcTranslateId
} = require('./util');

function parseCSVLine(line) {
  const results = [];
  const end = line.length - 1;
  let STATE = -1;
  let startIdx = 0;
  for (let i = 0; i <= end; i++) {
    const c = line.charCodeAt(i);
    if (STATE < 0) {
      if (c !== 34) continue;
      STATE = 0;
      startIdx = i;
    } else if (STATE === 0) {
      if (c === 92 && i !== end && line.charCodeAt(i + 1) === 34) {
        // meet \"
        i++;
        continue;
      }
      if (c !== 34) continue;
      STATE = -1;
      results.push(JSON.parse(line.substring(startIdx, i + 1)));
    }
  }
  return results;
}

class I18NManager {
  constructor() {
    this._dict = new Map();
    this._csvLoaded = false;
  }

  has(id) {
    return this._dict.has(id);
  }

  get(id) {
    return this._dict.get(id);
  }

  set(id, defaultLocaleText, buildLocalText) {
    return this._dict.set(id, [
      defaultLocaleText,
      buildLocalText || defaultLocaleText
    ]);
  }

  get size() {
    return this._dict.size;
  }

  async writeTranslateCSV(transDir, options) {
    const lines = [];
    this._dict.forEach((texts, id) => {
      const li = id.lastIndexOf('/');
      const sortV = li > 0 ? id.substring(0, li) : id;
      lines.push([id, texts[0], sortV]);
    });
    lines.sort((la, lb) => {
      if (la[2] === lb[2]) {
        return la[1] < lb[1] ? -1 : (la[1] > lb[1] ? 1 : 0);
      } else {
        return la[2] < lb[2] ? -1 : 1;
      }
    });
    const defaultLocale = options.defaultLocale;
    await fs.writeFile(
      path.join(transDir, `translate.${defaultLocale}.csv`),
      `"id","${defaultLocale}"\n` + lines.map(l => `${JSON.stringify(l[0])},${JSON.stringify(l[1])}`).join('\n')
    );
  }

  validate(resourcePath, info, opts) {
    if (info.key && !/^(\^)?[a-z0-9]+(\.[a-z0-9]+)*$/.test(info.key)) {
      return 'i18n "key" must match /^(\\^)?[a-z0-9]+(\\.[a-z0-9]+)*$/';
    }
    const {
      buildLocale, defaultLocale
    } = opts;
    const translateId = calcTranslateId(info, resourcePath, opts);
    if (buildLocale !== defaultLocale) {
      if (!this.has(translateId)) {
        return `i18n text with key: "${info.key}"(translate id: "${translateId}", original text: "${info.text || ''}") not found in locale ${buildLocale}, please check file "translate.${buildLocale}.csv".`;
      }
      const texts = this.get(translateId);
      if (info.text !== texts[0]) {
        return `default locale text with key "${info.key}"(translate id: "${translateId}") has changed. previous is "${texts[0]}", now is "${info.text}". You may need update translate csv files.`;
      }
      info.text = texts[1];
    } else {
      if (!this.has(translateId)) {
        if (!info.text) return `i18n text with key: "${info.key}"(translate id: ${translateId}) not found.`;
        this.set(translateId, info.text);
      } else {
        const txt = this.get(translateId);
        if (!info.text) {
          info.text = txt[0];
        } else if (info.text !== txt[0] && opts.checkConflict) {
          return `key "${info.key}"(translate id "${translateId}") in different place have conflict text "${info.text}" and "${txt[0]}". see https://todo`;
        }
      }
    }
  }

  loadTranslateCSV(options) {
    if (this._csvLoaded) return;
    this._csvLoaded = true;
    const buildLocale = options.buildLocale;
    const defaultLocale = options.defaultLocale;
    const defaultDict = new Map();
    const buildDict = new Map();
    const transDir = options.translateDir;
    let cnt = readFileSync(
      path.join(transDir, `translate.${defaultLocale}.csv`),
      'utf-8'
    );
    let lines = cnt.split(/\r?\n/);
    if (lines[0] !== `"id","${defaultLocale}"`) {
      throw new Error(`Bad format for "translate.${defaultLocale}.csv". First line not match. see https://todo.`);
    }
    lines.forEach((line, i) => {
      if (i === 0) return; // skip first line
      if (!line || !line.trim()) throw new Error(`Bad format for "translate.${defaultLocale}.csv". Wrong line format. see https://todo.`);
      const ws = parseCSVLine(line.trim());
      if (ws.length !== 2) throw new Error(`Bad format for "translate.${defaultLocale}.csv". Wrong line format. see https://todo.`);
      if (defaultDict.has(ws[0])) throw new Error(`dulplicate id "${ws[0]}" in "translate.${defaultLocale}.csv" at line ${i + 1}`);
      defaultDict.set(ws[0], ws[1]);
    });
    cnt = readFileSync(
      path.join(transDir, `translate.${buildLocale}.csv`),
      'utf-8'
    );
    lines = cnt.split(/\r?\n/);
    if (lines[0] !== `"id","${defaultLocale}","${buildLocale}"`) {
      throw new Error(`Bad format for "translate.${buildLocale}.csv". First line not match. see https://todo.`);
    }
    lines.forEach((line, i) => {
      if (i === 0) return; // skip first line
      if (!line || !line.trim()) {
        throw new Error(`Bad format for "translate.${buildLocale}.csv". Wrong line format. see https://todo.`);
      }
      const ws = parseCSVLine(line.trim());
      if (ws.length !== 3) {
        throw new Error(`Bad format for "translate.${buildLocale}.csv". Wrong line format. see https://todo.`);
      }
      if (buildDict.has(ws[0])) throw new Error(`dulplicate id "${ws[0]}" in "translate.${buildLocale}.csv" at line ${i + 1}`);
      if (!defaultDict.has(ws[0])) {
        throw new Error(`id "${ws[0]} in "translate.${buildLocale}.csv" at line ${i + 1} not found in "translate.${defaultLocale}.csv"`);
      }
      const defaultTxt = defaultDict.get(ws[0]);
      if (defaultTxt !== ws[1]) {
        throw new Error(`default locale text of id "${ws[0]} in "translate.${buildLocale}.csv" at line ${i + 1} is "${ws[1]}", which does not match original text "${defaultTxt}" in "translate.${defaultLocale}.csv". You may need update "translate.${buildLocale}.csv". see https://todo.`);
      }
      buildDict.set(ws[0], [ws[1], ws[2]]);
    });
    this._dict = buildDict;
  }
}

let INC = 0;
module.exports = {
  genId() {
    return '_jgsty_' + (INC++).toString(32);
  },
  components: new Map(),
  templates: new Map(),
  styles: new Map(),
  extractStyles: new Map(),
  extractComponentStyles: new Map(),
  i18n: new I18NManager()
};
