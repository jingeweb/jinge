import path from 'path';
import { fileURLToPath } from 'url';
import type { BuildOptions } from 'esbuild';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getOption(): BuildOptions {
  return {
    entryPoints: [path.resolve(__dirname, '../src/index.ts')],
    sourcemap: true,
    // external,
    packages: 'external',
    charset: 'utf8',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    // outdir: 'dist',
    outfile: `dist/index.js`,
  };
}

async function bundle() {
  const result = await esbuild.build(getOption());
  // console.log(result);
  if (result.errors?.length) {
    console.error(result.errors);
  } else {
    console.log(`==> dist/index.js bundled.`);
  }
}
(async () => {
  await Promise.all([bundle()]);

  if (process.env.WATCH) {
    const ctx = await esbuild.context(getOption());
    await ctx.watch();
    console.log('Watching For dist/index.mjs bundle...');
  }
})().catch((ex) => {
  console.error(ex);
});
