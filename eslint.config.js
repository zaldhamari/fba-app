// ─── ESLint guardrail ─────────────────────────────────────────────────────────
// Purpose: keep raw hex colors out of the app. CLAUDE.md mandates DS tokens from
// src/theme/ds.ts; this rule stops new hex literals from creeping back in.
// react-hooks plugin is included so exhaustive-deps disable comments are valid.
//
// Run:  npm run lint
//
// Scoped to src/**; the palette-definition files under src/theme are exempt since
// that is the one place hex values are allowed to live.

const tsParser       = require('@typescript-eslint/parser');
const reactHooks     = require('eslint-plugin-react-hooks');

const HEX_SELECTOR =
  "Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]";

module.exports = [
  {
    files: ['src/**/*.{ts,tsx}'],
    // Palette sources are allowed to define raw hex.
    ignores: ['src/theme/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // react-hooks: recommended rules (rules-of-hooks: error, exhaustive-deps: warn).
      // Both must be declared so that // eslint-disable-next-line react-hooks/*
      // comments in src/ are valid disable directives and don't produce errors.
      'react-hooks/rules-of-hooks':   'error',
      'react-hooks/exhaustive-deps':  'warn',
      'no-restricted-syntax': [
        'warn',
        {
          selector: HEX_SELECTOR,
          message:
            'Raw hex color is not allowed — use a DS token from src/theme/ds.ts instead.',
        },
      ],
    },
  },
];
