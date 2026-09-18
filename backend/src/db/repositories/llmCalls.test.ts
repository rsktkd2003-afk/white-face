// llm_callsリポジトリの基本的な健全性確認（T-DB-01/02の対象外だが、
// Step4で新規追加したコードの最低限の動作確認として実施する）。
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempDatabase } from '../../testing/tempDb.ts';
import type { TempDatabase } from '../../testing/tempDb.ts';
import { createConversation } from './conversations.ts';
import { createLlmCall } from './llmCalls.ts';

let temp: TempDatabase;

beforeEach(() => {
  temp = createTempDatabase();
});

afterEach(() => {
  temp.cleanup();
});

function baseInput(overrides: Partial<Parameters<typeof createLlmCall>[1]> = {}) {
  const startedAt = '2026-09-18T00:00:00.000Z';
  const finishedAt = '2026-09-18T00:00:01.000Z';
  return {
    userId: 'owner',
    purpose: 'conversationPlanning',
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    effort: 'low',
    conversationId: null,
    attempt: 1,
    status: 'success' as const,
    stopReason: 'end_turn',
    errorCode: null,
    errorMessage: null,
    inputTokens: 100,
    outputTokens: 50,
    cacheCreationInputTokens: null,
    cacheReadInputTokens: null,
    estimatedCostMicroUsd: 1000,
    costComplete: true,
    pricingVersion: '2026-09-16',
    latencyMs: 1000,
    firstTokenMs: 200,
    startedAt,
    finishedAt,
    ...overrides,
  };
}

describe('llm_calls リポジトリ', () => {
  it('記録した内容が実DBに保存される', () => {
    const record = createLlmCall(temp.db, baseInput());

    expect(record.id).toHaveLength(26);
    expect(record.status).toBe('success');
    expect(record.costComplete).toBe(true);

    const conn = temp.openVerificationConnection();
    try {
      const row = conn.prepare('SELECT * FROM llm_calls WHERE id = ?').get(record.id) as
        | { status: string; cost_complete: number; estimated_cost_micro_usd: number }
        | undefined;
      expect(row).toBeDefined();
      expect(row?.status).toBe('success');
      expect(row?.cost_complete).toBe(1);
      expect(row?.estimated_cost_micro_usd).toBe(1000);
    } finally {
      conn.close();
    }
  });

  it('conversationIdを指定してもFKとして機能する', () => {
    const conversation = createConversation(temp.db, { userId: 'owner', title: 'T' });
    const record = createLlmCall(temp.db, baseInput({ conversationId: conversation.id }));
    expect(record.conversationId).toBe(conversation.id);
  });

  it('存在しない会話IDを指定すると外部キー違反で失敗する', () => {
    expect(() => createLlmCall(temp.db, baseInput({ conversationId: 'non-existent-id' }))).toThrow();
  });

  it('costCompleteがfalseでも保存できる（推定費用が不完全な場合）', () => {
    const record = createLlmCall(temp.db, baseInput({ costComplete: false, outputTokens: null }));
    expect(record.costComplete).toBe(false);
  });
});
