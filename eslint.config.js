import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const anthropicSdkRestriction = {
  name: '@anthropic-ai/sdk',
  message: '@anthropic-ai/sdk は backend/src/llm/anthropicProvider.ts 以外から読み込めません（M1実装指示書14.6節）。',
};

const nodeSqliteRestriction = {
  name: 'node:sqlite',
  message: 'node:sqlite は backend/src/db/client.ts と backend/src/testing/ 以外から読み込めません（M1実装指示書14.6節）。',
};

const personaRestriction = {
  group: ['**/persona/*', '**/persona/**'],
  message: '人格定義は backend/src/conversation/conversationService.ts 以外から読み込めません（M1実装指示書14.6節）。',
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/drizzle/**',
      '**/data/**',
      '**/node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // ルート直下の設定ファイルは、どのworkspaceのtsconfigにも属さないため
    // 型情報を使うlintの対象外とする（typescript-eslint推奨の方法）。
    files: ['eslint.config.js', 'vitest.config.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ['backend/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [anthropicSdkRestriction, nodeSqliteRestriction],
          patterns: [personaRestriction],
        },
      ],
    },
  },
  {
    files: ['backend/src/llm/anthropicProvider.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [nodeSqliteRestriction],
          patterns: [personaRestriction],
        },
      ],
    },
  },
  {
    files: ['backend/src/db/client.ts', 'backend/src/testing/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [anthropicSdkRestriction],
          patterns: [personaRestriction],
        },
      ],
    },
  },
  {
    files: ['backend/src/conversation/conversationService.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [anthropicSdkRestriction, nodeSqliteRestriction],
        },
      ],
    },
  },
  {
    files: ['backend/src/llm/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ObjectExpression > Property[key.name='temperature']",
          message: 'Sonnet 5 では temperature を設定しない仕様です（M1実装指示書6.3節）。',
        },
        {
          selector: "ObjectExpression > Property[key.name='top_p']",
          message: 'Sonnet 5 では top_p を設定しない仕様です（M1実装指示書6.3節）。',
        },
        {
          selector: "ObjectExpression > Property[key.name='top_k']",
          message: 'Sonnet 5 では top_k を設定しない仕様です（M1実装指示書6.3節）。',
        },
      ],
    },
  },
);
