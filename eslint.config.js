import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import jest from 'eslint-plugin-jest';
import eslintConfigPrettier from 'eslint-config-prettier';
import { builtinModules } from 'node:module';
export default tseslint.config(
  eslint.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    plugins: {
      'import-x': importX,
    },
    rules: {
      'no-debugger': 'error',
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      'prefer-template': 'error',
      'sort-imports': ['error', { ignoreDeclarationSort: true }],
      '@typescript-eslint/no-floating-promises': ['error'],
      '@typescript-eslint/no-explicit-any': ['error'],
      // '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/prefer-optional-chain': 'error',
      'import-x/no-nodejs-modules': [
        'error',
        { allow: builtinModules.map((mod) => `node:${mod}`) },
      ],
      // Enforce the use of 'import type' for importing types
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      // Enforce the use of top-level import type qualifier when an import only has specifiers with inline type qualifiers
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },
  // Node scripts
  {
    files: ['scripts/**', '*.{js,mjs,ts}'],
    rules: {
      'no-console': 'off',
    },
  },
  // Jest
  {
    files: ['test/**'],
    ...jest.configs['flat/recommended'],
    rules: {
      ...jest.configs['flat/recommended'].rules,
      'jest/prefer-expect-assertions': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  // ignores
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/temp/',
      '**/coverage/',
      '.husky/',
      '.idea/',
      '.vscode/',
    ],
  },
);
