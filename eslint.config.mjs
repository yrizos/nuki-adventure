import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['dist/**', 'coverage/**']),
  {
    files: ['**/*.mjs'],
    extends: [eslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
]);
