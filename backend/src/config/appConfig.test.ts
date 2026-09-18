// T-CFG-01（実装指示書11章）: effortが不正な値、hostが127.0.0.1以外、modelが空、
// maxTokensが0以下のいずれでも起動エラーになることを確認する。
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigValidationError, loadConfig, validateConfig } from './appConfig.ts';

const CONFIG_DIR = '/tmp/whiteface-config-test';

function baseConfig(): Record<string, unknown> {
  return {
    server: { host: '127.0.0.1', port: 8787, devFrontendPort: 5173 },
    database: { path: '../data/whiteface.db' },
    llm: {
      roles: {
        conversationPlanning: {
          provider: 'anthropic',
          model: 'claude-sonnet-5',
          maxTokens: 8192,
          effort: 'low',
        },
      },
      requestTimeoutMs: 60000,
      retry: { maxAttempts: 3, backoffMs: [1000, 2000] },
    },
    conversation: { maxContextMessages: 40, maxInputChars: 20000 },
    budget: { monthlyUsd: 30, devTaskUsd: 2, warningRatio: 0.8 },
    frontend: { distPath: '../frontend/dist' },
  };
}

function conversationPlanningOf(config: Record<string, unknown>): Record<string, unknown> {
  const llm = config.llm as { roles: { conversationPlanning: Record<string, unknown> } };
  return llm.roles.conversationPlanning;
}

describe('T-CFG-01 設定の検証', () => {
  it('正しい設定は検証を通り、相対パスがconfigDir基準の絶対パスへ解決される', () => {
    const config = validateConfig(baseConfig(), CONFIG_DIR);
    expect(config.server.host).toBe('127.0.0.1');
    expect(config.database.path).toBe(path.resolve(CONFIG_DIR, '../data/whiteface.db'));
    expect(config.frontend.distPath).toBe(path.resolve(CONFIG_DIR, '../frontend/dist'));
  });

  it('effortが不正な値だと起動エラーになる', () => {
    const config = baseConfig();
    conversationPlanningOf(config).effort = 'invalid-effort';
    expect(() => validateConfig(config, CONFIG_DIR)).toThrow(ConfigValidationError);
  });

  it('hostが127.0.0.1以外だと起動エラーになる', () => {
    const config = baseConfig();
    (config.server as Record<string, unknown>).host = '0.0.0.0';
    expect(() => validateConfig(config, CONFIG_DIR)).toThrow(ConfigValidationError);
  });

  it('modelが空だと起動エラーになる', () => {
    const config = baseConfig();
    conversationPlanningOf(config).model = '';
    expect(() => validateConfig(config, CONFIG_DIR)).toThrow(ConfigValidationError);
  });

  it('maxTokensが0以下だと起動エラーになる', () => {
    const zero = baseConfig();
    conversationPlanningOf(zero).maxTokens = 0;
    expect(() => validateConfig(zero, CONFIG_DIR)).toThrow(ConfigValidationError);

    const negative = baseConfig();
    conversationPlanningOf(negative).maxTokens = -1;
    expect(() => validateConfig(negative, CONFIG_DIR)).toThrow(ConfigValidationError);
  });

  it('retry.backoffMsの要素数がmaxAttempts-1と一致しないと起動エラーになる', () => {
    const config = baseConfig();
    (config.llm as { retry: Record<string, unknown> }).retry.backoffMs = [1000];
    expect(() => validateConfig(config, CONFIG_DIR)).toThrow(ConfigValidationError);
  });

  it('warningRatioが0または1以上だと起動エラーになる', () => {
    const atOne = baseConfig();
    (atOne.budget as Record<string, unknown>).warningRatio = 1;
    expect(() => validateConfig(atOne, CONFIG_DIR)).toThrow(ConfigValidationError);

    const atZero = baseConfig();
    (atZero.budget as Record<string, unknown>).warningRatio = 0;
    expect(() => validateConfig(atZero, CONFIG_DIR)).toThrow(ConfigValidationError);
  });
});

describe('loadConfig 実ファイル統合（Step 5、backend/config/whiteface.config.json）', () => {
  const REAL_CONFIG_PATH = path.resolve(import.meta.dirname, '../../config/whiteface.config.json');

  it('実ファイルを読み込み、型検証・パス解決が期待どおりになる', () => {
    const config = loadConfig(REAL_CONFIG_PATH);

    expect(config.server).toEqual({ host: '127.0.0.1', port: 8787, devFrontendPort: 5173 });
    expect(config.llm.roles.conversationPlanning).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      maxTokens: 8192,
      effort: 'low',
    });
    expect(config.budget).toEqual({ monthlyUsd: 30, devTaskUsd: 2, warningRatio: 0.8 });

    // 相対パス（database.path、frontend.distPath）がconfigファイルのあるディレクトリ
    // （backend/config/）基準で絶対パスへ解決されていることを確認する。
    const configDir = path.dirname(REAL_CONFIG_PATH);
    expect(config.database.path).toBe(path.resolve(configDir, '../data/whiteface.db'));
    expect(config.frontend.distPath).toBe(path.resolve(configDir, '../frontend/dist'));
    expect(path.isAbsolute(config.database.path)).toBe(true);
    expect(path.isAbsolute(config.frontend.distPath)).toBe(true);
  });
});
