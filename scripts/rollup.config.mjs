import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import esbuild from 'rollup-plugin-esbuild';
import { transform } from 'esbuild';
import jingeCompiler from 'jinge-compiler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');
const COMP_DIR = path.join(SRC_DIR, 'components/');

function rollupJingePlugin() {
  return {
    name: 'jinge',
    async load(id) {
      if (!id.startsWith(COMP_DIR)) {
        return null;
      }
      const rf = path.relative(SRC_DIR, id);
      const src = await fs.readFile(id, 'utf-8');
      const { code, map } = await transform(src, {
        target: 'es2022',
        format: 'esm',
        loader: 'ts',
        sourcemap: true,
        sourcefile: `../src/${rf}`,
        sourcesContent: false,
      });
      const result = jingeCompiler.ComponentParser.parse(code, null, {
        resourcePath: id,
        _innerLib: true,
      });
      return {
        code: result.code,
        map,
      };
    },
  };
}
export default [
  {
    input: 'src/index.ts',
    output: {
      sourcemap: true,
      name: 'jinge',
      file: './dist/jinge.js',
      format: 'umd',
    },
    plugins: [
      resolve(),
      esbuild({
        target: 'es2022',
        format: 'esm',
      }),
      rollupJingePlugin(),
    ],
  },
  {
    input: 'src/index.ts',
    output: {
      sourcemap: true,
      name: 'jinge',
      file: './dist/jinge.min.js',
      format: 'umd',
    },
    plugins: [
      resolve(),
      rollupJingePlugin(),
      esbuild({
        target: 'es2022',
        format: 'esm',
      }),
      terser(),
    ],
  },
];
