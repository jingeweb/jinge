const { promises: fs } = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const glob = require('glob');
const { transform } = require('esbuild');
const { i18nRenderDeps, i18nRenderDepsRegisterFile } = require('../compiler/i18n');
const { ComponentParser, componentBaseManager } = require('../compiler/component');
const { sharedOptions } = require('../compiler/options');
const { getSymbolPostfix } = require('../compiler/util');
const { aliasManager } = require('../compiler/template');

const SRC_DIR = path.resolve(__dirname, '../src');
const LIB_DIR = path.resolve(__dirname, '../lib');
const SRC_COM_DIR = path.join(SRC_DIR, 'components/');
const LIB_COM_DIR = path.join(LIB_DIR, 'components/');
execSync(`rm -rf ${LIB_DIR}`);
execSync(`mkdir -p ${LIB_DIR}`);

sharedOptions.symbolPostfix = getSymbolPostfix();
componentBaseManager.initialize();
aliasManager.initialize();

function pglob(...args) {
  return new Promise((resolve, reject) => {
    glob(...args, (err, files) => {
      if (err) reject(err);
      resolve(files);
    });
  });
}
(async () => {
  await fs.writeFile(
    path.join(LIB_DIR, i18nRenderDepsRegisterFile),
    `import {${i18nRenderDeps.join(',')}} from './index';\n${i18nRenderDeps
      .map((d) => `/**/i18n.__regDep(0     , ${d});`)
      .join('\n')}`,
  );

  const files = await pglob(path.join(SRC_DIR, '**/*.ts'));
  for await (const file of files) {
    let { code, map, warnings } = await transform(await fs.readFile(file, 'utf-8'), {
      loader: 'ts',
      target: ['es2020'],
      sourcemap: true,
    });
    warnings?.length && warnings.forEach((w) => console.warn(w));
    if (!code) {
      return;
    }
    if (file.startsWith(SRC_COM_DIR) && !file.endsWith('index.ts')) {
      const r = await ComponentParser.parse(code, map, {
        resourcePath: path.join(LIB_COM_DIR, path.basename(file)),
        webpackLoaderContext: {
          context: '',
          resolve(ctx, source, callback) {
            // // if (source.startsWith('/')) debugger;
            // // console.log(source)
            // doResolve(id, source).then((file) => {
            //   callback(null, file);
            // }, callback);
            if (!/\.\w+$/.test(source)) source += '.js';
            callback(null, path.resolve(LIB_COM_DIR, source));
          },
        },
      });
      code = r.code;
    }
    let fn = path.relative(SRC_DIR, file);
    fn = fn.slice(0, fn.length - 3);
    execSync(`mkdir -p ${path.dirname(path.join(LIB_DIR, fn))}`);
    // console.log(path.join(LIB_DIR, fn + '.js'));
    await fs.appendFile(path.join(LIB_DIR, fn + '.js'), code);
    await fs.appendFile(path.join(LIB_DIR, fn + '.js.map'), map);
  }
})().catch((err) => {
  console.error(err);
  process.exit(-1);
});
