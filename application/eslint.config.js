// Flat config (ESLint 9+/10). Replaces the former .eslintrc.cjs.
// Scoped to .ts/.tsx so `eslint .` lints the same files the old
// `eslint . --ext .ts,.tsx` script did.
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
      },
      globals: {
        ...globals.browser,
        ...globals.node
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
      // react-hooks recommended (inlined so it is independent of the
      // plugin's flat/eslintrc config export shape across versions)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // TypeScript handles undefined-symbol checking itself; the core
      // no-undef rule misfires on type-only refs like `JSX`/`React`.
      // (@typescript-eslint/recommended disabled this via eslint-recommended.)
      'no-undef': 'off',
      // project overrides carried over verbatim from .eslintrc.cjs
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  }
]
