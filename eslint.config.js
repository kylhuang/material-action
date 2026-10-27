'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  // demo/ 內是「故意有問題」的範例檔，不納入 main 的 lint
  // demo/ holds intentionally broken examples; excluded so main stays green
  { ignores: ['node_modules/', 'demo/', '*.tgz'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'off',
    },
  },
];
