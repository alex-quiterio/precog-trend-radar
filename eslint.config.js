// ESLint: one rule, for now. Every if, else, for and while takes braces, even around a single statement:
//   if (signal.aborted) { return; }   never   if (signal.aborted) return;
// Formatting is Prettier's job (.prettierrc); this only checks what Prettier can't.
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: 'module',
    },
    rules: { curly: ['error', 'all'] },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        sourceType: 'module',
      },
    },
    rules: { curly: ['error', 'all'] },
  },
];
