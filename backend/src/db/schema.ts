// conversations・messages・llm_calls（実装指示書7.2節）。
// purposeとeffortにCHECK制約を付けない理由：将来値を追加する際にマイグレーションを
// 不要にするため。値の制限はTypeScriptの型で行う（実装指示書7.2節）。
import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

function sqlLiteral(value: string | number) {
  if (typeof value === 'number') {
    return sql.raw(String(value));
  }
  return sql.raw(`'${value.replace(/'/g, "''")}'`);
}

function inCheck(column: SQLiteColumn, values: readonly (string | number)[]) {
  return sql`${column} in (${sql.join(values.map(sqlLiteral), sql.raw(', '))})`;
}

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('conversations_user_updated_idx').on(table.userId, table.updatedAt, table.id)],
);

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id),
    userId: text('user_id').notNull(),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    inputMethod: text('input_method', { enum: ['text', 'voice'] }).notNull().default('text'),
    truncated: integer('truncated', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('messages_conversation_created_idx').on(table.conversationId, table.createdAt, table.id),
    check('messages_role_check', inCheck(table.role, ['user', 'assistant'])),
    check('messages_input_method_check', inCheck(table.inputMethod, ['text', 'voice'])),
    check('messages_truncated_check', inCheck(table.truncated, [0, 1])),
  ],
);

export const llmCalls = sqliteTable(
  'llm_calls',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    // purpose・providerは値の制限をTypeScriptの型で行うためCHECKを付けない。
    purpose: text('purpose').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    effort: text('effort'),
    conversationId: text('conversation_id').references(() => conversations.id),
    attempt: integer('attempt').notNull(),
    status: text('status', { enum: ['success', 'error', 'aborted'] }).notNull(),
    stopReason: text('stop_reason'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cacheCreationInputTokens: integer('cache_creation_input_tokens'),
    cacheReadInputTokens: integer('cache_read_input_tokens'),
    estimatedCostMicroUsd: integer('estimated_cost_micro_usd').notNull().default(0),
    costComplete: integer('cost_complete', { mode: 'boolean' }).notNull(),
    pricingVersion: text('pricing_version').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    firstTokenMs: integer('first_token_ms'),
    startedAt: text('started_at').notNull(),
    finishedAt: text('finished_at').notNull(),
  },
  (table) => [
    index('llm_calls_started_at_idx').on(table.startedAt),
    check('llm_calls_status_check', inCheck(table.status, ['success', 'error', 'aborted'])),
    check('llm_calls_cost_complete_check', inCheck(table.costComplete, [0, 1])),
  ],
);
