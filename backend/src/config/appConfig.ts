// M1 Step 3: 設定ファイルの型ガードによる検証（実装指示書3.2節）。
// 料金表にモデルが存在するかの検証（3.1節の手順3）はStep 6のllm/pricing.tsで追加する。
import { readFileSync } from 'node:fs';
import path from 'node:path';

const LLM_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type LlmEffort = (typeof LLM_EFFORTS)[number];

export interface WhitefaceConfig {
  server: { host: string; port: number; devFrontendPort: number };
  database: { path: string };
  llm: {
    roles: {
      conversationPlanning: {
        provider: 'anthropic';
        model: string;
        maxTokens: number;
        effort: LlmEffort;
      };
    };
    requestTimeoutMs: number;
    retry: { maxAttempts: number; backoffMs: number[] };
  };
  conversation: { maxContextMessages: number; maxInputChars: number };
  budget: { monthlyUsd: number; devTaskUsd: number; warningRatio: number };
  frontend: { distPath: string };
}

export class ConfigValidationError extends Error {}

function fail(message: string): never {
  throw new ConfigValidationError(`設定ファイルが不正です: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isPositiveNumber(value) && Number.isInteger(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * 設定オブジェクトを検証し、相対パスをconfigDir基準の絶対パスへ解決した
 * WhitefaceConfigを返す。不正な場合はConfigValidationErrorを投げる。
 */
export function validateConfig(value: unknown, configDir: string): WhitefaceConfig {
  if (!isRecord(value)) {
    fail('ルートはオブジェクトである必要があります');
  }

  const server = value.server;
  if (!isRecord(server)) fail('server が不正です');
  if (server.host !== '127.0.0.1') fail("server.host は '127.0.0.1' である必要があります");
  if (!isPositiveInteger(server.port)) fail('server.port は正の整数である必要があります');
  if (!isPositiveInteger(server.devFrontendPort)) fail('server.devFrontendPort は正の整数である必要があります');

  const database = value.database;
  if (!isRecord(database)) fail('database が不正です');
  if (!isNonEmptyString(database.path)) fail('database.path は空でない文字列である必要があります');

  const llm = value.llm;
  if (!isRecord(llm)) fail('llm が不正です');
  const roles = llm.roles;
  if (!isRecord(roles)) fail('llm.roles が不正です');
  const conversationPlanning = roles.conversationPlanning;
  if (!isRecord(conversationPlanning)) fail('llm.roles.conversationPlanning が不正です');
  if (conversationPlanning.provider !== 'anthropic') {
    fail("llm.roles.conversationPlanning.provider は 'anthropic' である必要があります");
  }
  if (!isNonEmptyString(conversationPlanning.model)) {
    fail('llm.roles.conversationPlanning.model は空でない文字列である必要があります');
  }
  if (!isPositiveInteger(conversationPlanning.maxTokens)) {
    fail('llm.roles.conversationPlanning.maxTokens は正の整数である必要があります');
  }
  if (!LLM_EFFORTS.includes(conversationPlanning.effort as LlmEffort)) {
    fail(`llm.roles.conversationPlanning.effort は ${LLM_EFFORTS.join(' / ')} のいずれかである必要があります`);
  }
  if (!isPositiveInteger(llm.requestTimeoutMs)) fail('llm.requestTimeoutMs は正の整数である必要があります');

  const retry = llm.retry;
  if (!isRecord(retry)) fail('llm.retry が不正です');
  if (!isPositiveInteger(retry.maxAttempts)) fail('llm.retry.maxAttempts は正の整数である必要があります');
  if (
    !Array.isArray(retry.backoffMs) ||
    !retry.backoffMs.every((v) => isPositiveInteger(v)) ||
    retry.backoffMs.length !== retry.maxAttempts - 1
  ) {
    fail('llm.retry.backoffMs の要素数は maxAttempts - 1 と一致する正の整数の配列である必要があります');
  }

  const conversation = value.conversation;
  if (!isRecord(conversation)) fail('conversation が不正です');
  if (!isPositiveInteger(conversation.maxContextMessages)) {
    fail('conversation.maxContextMessages は正の整数である必要があります');
  }
  if (!isPositiveInteger(conversation.maxInputChars)) {
    fail('conversation.maxInputChars は正の整数である必要があります');
  }

  const budget = value.budget;
  if (!isRecord(budget)) fail('budget が不正です');
  if (!isPositiveNumber(budget.monthlyUsd)) fail('budget.monthlyUsd は正の数である必要があります');
  if (!isPositiveNumber(budget.devTaskUsd)) fail('budget.devTaskUsd は正の数である必要があります');
  if (typeof budget.warningRatio !== 'number' || !(budget.warningRatio > 0 && budget.warningRatio < 1)) {
    fail('budget.warningRatio は 0 より大きく 1 未満である必要があります');
  }

  const frontend = value.frontend;
  if (!isRecord(frontend)) fail('frontend が不正です');
  if (!isNonEmptyString(frontend.distPath)) fail('frontend.distPath は空でない文字列である必要があります');

  return {
    server: {
      host: server.host,
      port: server.port,
      devFrontendPort: server.devFrontendPort,
    },
    database: { path: path.resolve(configDir, database.path) },
    llm: {
      roles: {
        conversationPlanning: {
          provider: 'anthropic',
          model: conversationPlanning.model,
          maxTokens: conversationPlanning.maxTokens,
          effort: conversationPlanning.effort as LlmEffort,
        },
      },
      requestTimeoutMs: llm.requestTimeoutMs,
      retry: {
        maxAttempts: retry.maxAttempts,
        backoffMs: retry.backoffMs,
      },
    },
    conversation: {
      maxContextMessages: conversation.maxContextMessages,
      maxInputChars: conversation.maxInputChars,
    },
    budget: {
      monthlyUsd: budget.monthlyUsd,
      devTaskUsd: budget.devTaskUsd,
      warningRatio: budget.warningRatio,
    },
    frontend: { distPath: path.resolve(configDir, frontend.distPath) },
  };
}

/** configファイルを読み込んで検証する。main.tsから呼び出す想定（実装指示書3.1節手順2）。 */
export function loadConfig(configPath: string): WhitefaceConfig {
  const raw: unknown = JSON.parse(readFileSync(configPath, 'utf-8'));
  return validateConfig(raw, path.dirname(configPath));
}
