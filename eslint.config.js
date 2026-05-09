import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Treat leading-underscore identifiers as intentionally unused.
      // Standard TS/JS convention — `_canvasWidth`, `_unused`, etc. signals
      // "I know this isn't used; keep the name for documentation/API parity."
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // Baseline-tracked tech debt — currently 76 violations across the
      // codebase (53 no-explicit-any + 18 react-hooks/refs + 3 immutability
      // + 2 set-state-in-effect). Downgraded to warn so CI can ratchet via
      // `--max-warnings <N>`: existing debt doesn't break the build, but a
      // new violation pushes the count over the cap and fails the gate.
      // Lower the cap whenever a cleanup PR reduces the number.
      // See .github/workflows/ci.yml.
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
