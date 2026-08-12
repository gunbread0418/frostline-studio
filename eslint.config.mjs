import eslint from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'dist-electron/**', 'coverage/**', 'node_modules/**', 'release/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: reactHooks.configs.flat.recommended.rules,
  },
  {
    files: [
      'electron/**/*.ts',
      'scripts/**/*.mjs',
      '*.config.{ts,mts,mjs}',
      'vitest.setup.ts',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
);
