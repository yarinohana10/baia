import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'storybook-static/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'plugin:storybook/recommended'),
  {
    // Pre-existing code relies on these; keep them visible without failing the build.
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'storybook/no-redundant-story-name': 'warn',
    },
  },
];

export default eslintConfig;
