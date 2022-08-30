module.exports = {
  plugins: ['import'],
  env: {
    es6: true,
    browser: true,
  },
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:prettier/recommended',
  ],
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts'],
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true, // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`

        // Choose from one of the "project" configs below or omit to use <root>/tsconfig.json by default

        // use <root>/path/to/folder/tsconfig.json
        project: './tsconfig.json',
      },
    },
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    'import/order': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    'no-console': 'error',
    'prettier/prettier': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/prefer-optional-chain': 'error',
  },
  overrides: [
    {
      files: ['scripts/**/*.js', '*.js'],
      env: {
        node: true,
        browser: false,
        es6: true,
      },
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/prefer-optional-chain': 'off',
      },
    },
  ],
};
