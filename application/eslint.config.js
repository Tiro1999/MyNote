// Rules cover .ts/.tsx; globals and no-console are set per process below.
const js = require('@eslint/js')
const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const reactPlugin = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')
const globals = require('globals')

// Renderer module boundaries: each module may import only the listed modules, through their barrel
const MODULES = {
  ui: [],
  storage: [],
  settings: ['storage', 'ui'],
  notebook: ['storage', 'ui'],
  editor: ['notebook', 'storage', 'ui'],
  canvas: ['editor', 'notebook', 'storage', 'ui'],
  finance: ['editor', 'notebook', 'storage', 'ui'],
  app: ['canvas', 'editor', 'finance', 'notebook', 'settings', 'storage', 'ui']
}
const MODULE_NAMES = Object.keys(MODULES).sort()

// window.api is reached only through storage and these files; tests may fake it
const WINDOW_API_ALLOWED = [
  'src/renderer/src/storage/**',
  'src/renderer/src/settings/**',
  'src/renderer/src/editor/links/openFailed.ts',
  'src/renderer/src/finance/transfer/**',
  '**/*.test.{ts,tsx}',
  '**/*.testing.ts'
]
const BLOCKING_DIALOGS = ['confirm', 'alert', 'prompt']
const BLOCKING_DIALOG_MESSAGE = 'Blocking dialogs are banned: use ConfirmDialog, Modal or notify from @renderer/ui.'

const moduleBoundaries = Object.entries(MODULES).map(([name, allowed]) => ({
  files: [`src/renderer/src/${name}/**`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            regex: `^@renderer/(${MODULE_NAMES.filter((other) => !allowed.includes(other)).join('|')})$`,
            message: `${name} may import: ${allowed.join(', ') || 'no other module'}.`
          },
          {
            regex: '^@renderer/[^/]+/',
            message: 'Import the module barrel @renderer/<module>, not a file inside it.'
          },
          {
            regex: `^(\\.\\./)+(${MODULE_NAMES.join('|')})(/|$)`,
            message: 'Import another module through @renderer/<module>, not a relative path.'
          }
        ]
      }
    ]
  }
}))

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
    files: ['src/renderer/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...BLOCKING_DIALOGS.map((name) => ({ name, message: BLOCKING_DIALOG_MESSAGE }))
      ],
      'no-restricted-properties': [
        'error',
        ...BLOCKING_DIALOGS.map((property) => ({ object: 'window', property, message: BLOCKING_DIALOG_MESSAGE }))
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='window'][property.name='api']",
          message: 'Reach the main process through @renderer/storage, not window.api.'
        }
      ]
    }
  },
  {
    files: WINDOW_API_ALLOWED,
    rules: { 'no-restricted-syntax': 'off' }
  },
  {
    files: ['src/shared/log.ts'],
    rules: { 'no-console': 'off' }
  },
  ...moduleBoundaries,
  {
    files: ['src/main/**', 'src/preload/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^@renderer(/|$)|(^|/)renderer(/|$)',
              message: 'main and preload never import renderer code.'
            }
          ]
        }
      ]
    }
  }
]
