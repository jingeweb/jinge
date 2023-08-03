module.exports = {
  plugins: ['import'],
  env: {
    node: true,
    es6: true,
  },
  extends: ['plugin:import/recommended', 'plugin:prettier/recommended'],

  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    'import/order': 'error',
    'no-console': 'off',
    'prettier/prettier': 'error',
  },
  overrides: [
    {
      files: ['src/**/*.ts'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:import/recommended',
        'plugin:import/typescript',
        'plugin:prettier/recommended',
      ],
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: ['./tsconfig.json'], // Specify it only for TypeScript files
      },
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
      env: {
        es6: true,
        browser: true,
      },
      rules: {
        'no-console': 'error',
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/prefer-optional-chain': 'error',

        // '@typescript-eslint/no-var-requires': 'off',
        // '@typescript-eslint/no-explicit-any': 'off',
        // '@typescript-eslint/explicit-module-boundary-types': 'off',
        // '@typescript-eslint/prefer-optional-chain': 'off',
      },
    },
  ],
};
