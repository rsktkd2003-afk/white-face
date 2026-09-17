// M1 Step 2: conversations・messages テーブルのみ（実装指示書7.2節）。
// llm_calls は Step 4 で追加する。
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
