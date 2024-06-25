/* global module */
/**
 * @type {import('eslint-define-config').ESLintConfig}
 */
module.exports = {
  env: { node: false, browser: true },
  parser: '@typescript-eslint/parser',
  plugins: ['import', '@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
  },
  rules: {
    'import/order': 'error',
    'import/no-unresolved': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    'no-console': ['error', { allow: ['error'] }],
    'prettier/prettier': 'error',
    '@typescript-eslint/no-floating-promises': ['error'],
    '@typescript-eslint/no-explicit-any': ['error'],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
  },
  overrides: [
    {
      files: ['./scripts/**/*.ts'],
      env: { node: true, browser: false },
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
