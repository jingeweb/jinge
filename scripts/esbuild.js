const path = require('path');
const { promises: fs } = require('fs');
const { execSync } = require('child_process');
const { ComponentParser } = require('jinge-compiler');
const esbuild = require('esbuild');
const chokidar = require('chokidar');
const WATCH = process.env.WATCH === 'true';
const SRC_DIR = path.resolve(__dirname, '../src');
const debugTargetProjectDir = (() => {
  const dir = process.env.DEBUG_PROJECT;
  return dir ? path.join(dir, 'node_modules/jinge/dist') : undefined;
})();
const DIST_DIR = debugTargetProjectDir || path.resolve(__dirname, '../lib');
const COMP_DIR = path.join(SRC_DIR, 'components/');

async function glob(dir) {
  const subs = await fs.readdir(dir);
  let files = [];
  for await (const sub of subs) {
    if (/\.ts$/.test(sub)) {
      files.push(path.join(dir, sub));
    } else if (!/\./.test(sub)) {
      files = files.concat(await glob(path.join(dir, sub)));
    }
  }
  return files;
}

async function transformFile(file) {
  const src = await fs.readFile(file, 'utf-8');
  const rf = path.relative(SRC_DIR, file);
  let { code, map, warnings } = await esbuild.transform(src, {
    target: 'es2020',
    format: 'esm',
    loader: path.extname(file).slice(1),
    sourcemap: true,
    sourcefile: `${path.relative(file, SRC_DIR)}/src/${rf}`,
    sourcesContent: false,
  });
  if (warnings?.length) console.error(warnings);
  if (!code) return; // ignore empty file
  if (file.startsWith(COMP_DIR)) {
    const result = ComponentParser.parse(code, null, {
      resourcePath: file,
      _innerLib: true,
    });
    code = result.code;
  }
  const distfile = path.join(DIST_DIR, rf.replace(/\.ts$/, '.js'));
  execSync(`mkdir -p ${path.dirname(distfile)}`);
  await Promise.all([
    fs.writeFile(distfile, code + `\n//# sourceMappingURL=${path.basename(distfile) + '.map'}`),
    fs.writeFile(
      distfile + '.map',
      map.replace('"version": 3', `"version": 3,\n  "sourceRoot": "",\n  "file": "${path.basename(distfile)}"`),
    ),
  ]);
}

async function handleChange(file) {
  if (!/\.(ts)$/.test(file)) return;
  const rf = path.relative(SRC_DIR, file);
  try {
    await transformFile(file);
    console.log(rf, 'compiled.');
  } catch (ex) {
    console.error(rf, 'failed.');
    console.error(ex);
  }
}
(async () => {
  const files = await glob(SRC_DIR);
  for await (const file of files) {
    await transformFile(file);
  }
  console.log('Build finished.');
  if (!WATCH) return;
  console.log('Continue watching...');
  chokidar
    .watch(path.join(SRC_DIR, '**/*.ts'), {
      ignoreInitial: true,
    })
    .on('add', (file) => handleChange(file))
    .on('change', (file) => handleChange(file));
})().catch((err) => {
  console.error(err);
  process.exit(-1);
});
