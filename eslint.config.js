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
  // ─── Trust Boundary: src/agentic/** can only import from barrel exports
  //     (../index.js, ../protocols/index.js at any depth), relative paths
  //     within src/agentic/, or external packages. ───
  {
    files: ['src/agentic/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                // ── Direct src/ internal modules (depth 1: from src/agentic/*.ts) ──
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
                '../provider/*',
                '../provider/**',
                '../crypto/*',
                '../crypto/**',
                // ── Protocol internals (barrel ../protocols/index.js is allowed) ──
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
                // ── Same modules at depth 2: from src/agentic/mcp/*.ts ──
                '../../kms-client.js',
                '../../kms-client',
                '../../kms-signer.js',
                '../../kms-signer',
                '../../evm-signer.util.js',
                '../../evm-signer.util',
                '../../types.js',
                '../../types',
                '../../core/*',
                '../../core/**',
                '../../providers/*',
                '../../providers/**',
                '../../provider/*',
                '../../provider/**',
                '../../crypto/*',
                '../../crypto/**',
                '../../protocols/types.js',
                '../../protocols/types',
                '../../protocols/registry.js',
                '../../protocols/registry',
                '../../protocols/dispatcher.js',
                '../../protocols/dispatcher',
                '../../protocols/decoders/*',
                '../../protocols/decoders/**',
                '../../protocols/policy/*',
                '../../protocols/policy/**',
                // ── Same modules at depth 3: from src/agentic/mcp/tools/*.ts ──
                '../../../kms-client.js',
                '../../../kms-client',
                '../../../kms-signer.js',
                '../../../kms-signer',
                '../../../evm-signer.util.js',
                '../../../evm-signer.util',
                '../../../types.js',
                '../../../types',
                '../../../core/*',
                '../../../core/**',
                '../../../providers/*',
                '../../../providers/**',
                '../../../provider/*',
                '../../../provider/**',
                '../../../crypto/*',
                '../../../crypto/**',
                '../../../protocols/types.js',
                '../../../protocols/types',
                '../../../protocols/registry.js',
                '../../../protocols/registry',
                '../../../protocols/dispatcher.js',
                '../../../protocols/dispatcher',
                '../../../protocols/decoders/*',
                '../../../protocols/decoders/**',
                '../../../protocols/policy/*',
                '../../../protocols/policy/**',
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
