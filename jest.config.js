import { pathsToModuleNameMapper } from 'ts-jest';
// In the following statement, replace `./tsconfig` with the path to your `tsconfig` file
// which contains the path mapping (ie the `compilerOptions.paths` option):
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.dirname);
const {
  compilerOptions: { baseUrl, paths },
} = require(path.resolve(import.meta.dirname, './tsconfig.json'));

/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  coverageProvider: 'v8',
  reporters: ['default'],
  transform: {
    '^.+.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  modulePaths: baseUrl ? [baseUrl] : undefined,
  moduleNameMapper: paths
    ? pathsToModuleNameMapper(paths /*, { prefix: '<rootDir>/' } */)
    : undefined,
};
