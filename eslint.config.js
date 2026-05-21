import jsPlugin from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import eslintPluginJsonc from 'eslint-plugin-jsonc';
import perfectionist from 'eslint-plugin-perfectionist';
import {defineConfig} from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  jsPlugin.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  perfectionist.configs['recommended-natural'],
  {
    languageOptions: {
      parserOptions: {
        // extraFileExtensions: ['.json5', '.jsonc'],
        project: ['tsconfig.json', 'tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.js'],
    plugins: {
      '@perfectionist': perfectionist,
      '@stylistic': stylistic,
    },
    rules: {
      '@perfectionist/sort-classes': ['error', {partitionByNewLine: true}],
      '@stylistic/lines-around-comment': [
        'warn',
        {
          afterBlockComment: false,
          allowArrayStart: true,
          allowBlockStart: true,
          allowClassStart: true,
          allowInterfaceStart: true,
          allowObjectStart: true,
          beforeBlockComment: false,
        },
      ],
      '@stylistic/lines-between-class-members': ['error', 'always'],
      '@stylistic/semi': 'error',

      '@typescript-eslint/consistent-type-exports': [
        'error',
        {fixMixedExportsWithInlineTypeSpecifier: true},
      ],

      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          disallowTypeAnnotations: true,
          fixStyle: 'inline-type-imports',
          prefer: 'type-imports',
        },
      ],

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-invalid-void-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',

      '@typescript-eslint/no-unnecessary-boolean-literal-compare': [
        'error',
        {
          allowComparingNullableBooleansToFalse: true,
          allowComparingNullableBooleansToTrue: true,
        },
      ],

      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'warn',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
        },
      ],

      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',

      '@typescript-eslint/unified-signatures': [
        'error',
        {
          ignoreDifferentlyNamedParameters: true,
        },
      ],

      curly: 'error',
      'func-style': ['error', 'expression'],
      'new-cap': ['error', {capIsNew: true, newIsCap: true}],
      'no-constructor-return': 'error',
      'no-empty': ['error', {allowEmptyCatch: true}],
      'no-self-compare': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-arrow-callback': 'error',
      semi: 'error',
    },
  },
  {
    files: ['test/**/*.test.ts', 'test/**/*.test.js'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  // Root-level JS config files live outside the TypeScript project, so
  // disable type-aware rules for them.
  {
    extends: [tseslint.configs.disableTypeChecked],
    files: ['*.js', '*.mjs', '*.cjs', 'scripts/**/*.js'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: false,
      },
    },
  },
  ...eslintPluginJsonc.configs['flat/prettier'].map((config) => ({
    ...config,
    extends: [tseslint.configs.disableTypeChecked],
    files: ['**/tsconfig*.json', '**/*.json5', '**/*.jsonc'],
  })),
  {
    ignores: [
      '**/docs/**',
      '**/dist/**',
      'coverage',
      '**/*.snapshot',
      '**/.tmp/**/*',
      '.worktrees/**/*',
    ],
  },
);
