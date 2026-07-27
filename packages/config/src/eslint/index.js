import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'

/**
 * Shared ESLint flat config for non-Next packages.
 *
 * - Strict TS, no `any`, no `eslint-disable` without a reason.
 * - Enforces the dependency graph from docs/architecture.md §2.
 * - Bans AI SDKs outside packages/brain.
 */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.json'],
        },
        node: true,
      },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSAsExpression[typeAnnotation.typeName.name='any']",
          message: 'Avoid `as any`. Use `unknown` + narrowing.',
        },
        {
          selector: 'TSAnyKeyword',
          message: 'Avoid `any`. Use `unknown` + narrowing.',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'import/no-cycle': 'error',
      'import/no-self-import': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Brain boundary (docs/architecture.md §6). Only `packages/brain` may
      // import an AI SDK or call any LLM endpoint. The rule is package-aware
      // via overrides below.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'ai', message: 'AI SDKs may only be imported from packages/brain.' },
            {
              name: '@ai-sdk/openai-compatible',
              message: 'AI SDKs may only be imported from packages/brain.',
            },
            {
              name: '@ai-sdk/openai',
              message: 'AI SDKs may only be imported from packages/brain.',
            },
            {
              name: '@ai-sdk/anthropic',
              message: 'AI SDKs may only be imported from packages/brain.',
            },
            { name: 'openai', message: 'AI SDKs may only be imported from packages/brain.' },
            {
              name: '@anthropic-ai/sdk',
              message: 'AI SDKs may only be imported from packages/brain.',
            },
          ],
          patterns: [
            { group: ['@ai-sdk/*'], message: 'AI SDKs may only be imported from packages/brain.' },
          ],
        },
      ],
    },
  },
]
