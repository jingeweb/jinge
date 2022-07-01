import resolve from '@rollup/plugin-node-resolve';
import sourcemaps from 'rollup-plugin-sourcemaps';
import { terser } from 'rollup-plugin-terser';

export default [
  {
    input: 'lib/index.js',
    output: {
      sourcemap: true,
      name: 'jinge',
      file: './dist/jinge.js',
      format: 'umd',
    },
    plugins: [sourcemaps(), resolve()],
  },
  {
    input: 'lib/index.js',
    output: {
      sourcemap: true,
      name: 'jinge',
      file: './dist/jinge.min.js',
      format: 'umd',
    },
    plugins: [sourcemaps(), resolve(), terser()],
  },
];
