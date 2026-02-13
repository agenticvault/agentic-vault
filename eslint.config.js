import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  // ─── Trust Boundary: src/agentic/** can only import from ../index.js,
  //     relative paths within src/agentic/, or external packages. ───
  {
    files: ['src/agentic/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../kms-client.js',
                '../kms-client',
                '../kms-signer.js',
                '../kms-signer',
                '../evm-signer.util.js',
                '../evm-signer.util',
                '../types.js',
                '../types',
                '../core/*',
                '../core/**',
                '../providers/*',
                '../providers/**',
                '../crypto/*',
                '../crypto/**',
                '../protocols/types.js',
                '../protocols/types',
                '../protocols/registry.js',
                '../protocols/registry',
                '../protocols/dispatcher.js',
                '../protocols/dispatcher',
                '../protocols/decoders/*',
                '../protocols/decoders/**',
                '../protocols/policy/*',
                '../protocols/policy/**',
                '../../*',
                '../../**',
              ],
              message:
                'Trust boundary violation: src/agentic/ can only import from ../index.js, ../protocols/index.js, relative paths within src/agentic/, or external packages.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['**/dist/', '**/node_modules/', '**/*.config.*'],
  },
);
