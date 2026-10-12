// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'reports/', '.stryker-tmp/', 'zalohy/', '**/*.js', '**/*.mjs', '**/*.cjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // A forgotten await = a pass that is "done" before it was recorded.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // Logging goes through Nest's Logger (timestamp, context); console only where marked.
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      // Secrets and config come from DeviceConfig/DbConfig/AuthConfig, read once at startup.
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Read env only in *.config.ts / config/env.ts / main.ts.' },
      ],
    },
  },
  {
    files: ['src/**/*.config.ts', 'src/config/env.ts', 'src/main.ts', 'src/fake-device.ts', 'src/entries/entries.module.ts', 'test/**/*.ts', 'scripts/**/*.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    // Tests use stubs and partial objects on purpose.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
);
