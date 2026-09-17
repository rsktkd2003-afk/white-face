import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const anthropicSdkRestriction = {
  name: '@anthropic-ai/sdk',
  message: '@anthropic-ai/sdk は backend/src/llm/anthropicProvider.ts 以外から読み込めません（M1実装指示書14.6節）。',
};

// Step 2 approved deviation（docs/deviations/step2-db-driver.md参照）: node:sqlite → better-sqlite3
const sqliteDriverRestriction = {
  name: 'better-sqlite3',
  message: 'better-sqlite3 は backend/src/db/client.ts と backend/src/testing/ 以外から読み込めません（M1実装指示書14.6節、Step2 approved deviation）。',
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
    // 各workspaceのtsconfigのincludeに含まれない設定ファイル（*.config.ts等）は、
    // 型情報を使うlintの対象外とする（typescript-eslint推奨の方法）。
    files: ['**/*.config.{js,ts,mjs,cjs}'],
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
          paths: [anthropicSdkRestriction, sqliteDriverRestriction],
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
          paths: [sqliteDriverRestriction],
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
          paths: [anthropicSdkRestriction, sqliteDriverRestriction],
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
