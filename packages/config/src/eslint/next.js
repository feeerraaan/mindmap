import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import a11y from 'eslint-plugin-jsx-a11y'
import importPlugin from 'eslint-plugin-import'

/**
 * ESLint flat config for Next.js apps (apps/web).
 *
 * Adds Next.js, React, hooks, and a11y rules on top of the shared base.
 */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        React: 'readonly',
        JSX: 'readonly',
        window: 'readonly',
        document: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': a11y,
      import: importPlugin,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: { project: ['./tsconfig.json'] },
        node: true,
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'jsx-a11y/anchor-is-valid': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'import/no-cycle': 'error',
      'import/no-self-import': 'error',
      eqeqeq: ['error', 'always'],
      // Brain boundary (docs/architecture.md §6). Only `packages/brain` may
      // import an AI SDK or call any LLM endpoint. The Next app routes
      // through `Brain.knowledge.buildGraph`, never directly to a provider.
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
