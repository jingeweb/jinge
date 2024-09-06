import { resolve } from 'node:path';
import { promises as fs } from 'node:fs';
import { defineConfig } from 'vite';

const PROD = process.env.NODE_ENV === 'production';
export default defineConfig({
  plugins: PROD
    ? [
        {
          name: 'PLUGIN',
          load(id) {
            return fs.readFile(id, 'utf-8').then((res) => {
              return (
                res
                  // BEGIN_DROP_IN_PRODUCTION 和 END_DROP_IN_PRODUCTION 之间的代码会在构建 production 版本时删除。
                  .replace(/\/\/ BEGIN_DROP_IN_PRODUCTION[\d\D]+?\/\/ END_DROP_IN_PRODUCTION/g, '')
                  // Symbol() 的描述文本会在构建 production 版本时删除
                  .replace(/\bSymbol\([^)]+\)/g, 'Symbol()')
              );
            });
          },
        },
      ]
    : [],
  build: {
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: `jinge.${PROD ? 'prod' : 'dev'}.js`,
      },
    },
    minify: PROD,
    lib: {
      entry: resolve(__dirname, '../src/index.ts'),
      formats: ['es'],
    },
  },
});
