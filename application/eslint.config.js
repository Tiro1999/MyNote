// Rules cover .ts/.tsx; globals and no-console are set per process below.
const js = require('@eslint/js')
const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const reactPlugin = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')
const globals = require('globals')

module.exports = [
  { ignores: ['out/**', 'dist/**', 'node_modules/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      // react-hooks recommended, inlined so it does not depend on the plugin's config export shape
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // TypeScript checks undefined names; the core rule misfires on type-only refs like JSX
      'no-undef': 'off',
      'no-console': 'error',
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['src/main/**', 'src/preload/**', '*.{js,ts}'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['src/renderer/**'],
    languageOptions: { globals: globals.browser }
  },
  {
    files: ['src/shared/log.ts'],
    rules: { 'no-console': 'off' }
  }
]
