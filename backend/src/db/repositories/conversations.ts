// M1 Step 4: 会話のリポジトリ（実装指示書7章）。
// db/repositories/* が扱うのはdbとスキーマだけ（実装指示書8.1節）。
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { generateUlid } from '../../ids/ulid.ts';
import { now } from '../../time/clock.ts';
import type { WhitefaceDb } from '../client.ts';
import { conversations } from '../schema.ts';

export type ConversationRecord = typeof conversations.$inferSelect;

export interface CreateConversationInput {
  userId: string;
  title: string;
}

/** 会話を1件作成する。id・created_at・updated_atはここで採番する。 */
export function createConversation(db: WhitefaceDb, input: CreateConversationInput): ConversationRecord {
  const timestamp = now().toISOString();
  const record: ConversationRecord = {
    id: generateUlid(),
    userId: input.userId,
    title: input.title,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.insert(conversations).values(record).run();
  return record;
}

interface Cursor {
  updatedAt: string;
  id: string;
}

/** cursorは「直前ページ最後のupdatedAtとidの組」を不透明な文字列にしたもの（実装指示書5章補足）。 */
function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf-8').toString('base64url');
}

function decodeCursor(value: string): Cursor {
  const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf-8'));
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { updatedAt?: unknown }).updatedAt !== 'string' ||
    typeof (parsed as { id?: unknown }).id !== 'string'
  ) {
    throw new Error('不正なcursorです');
  }
  return parsed as Cursor;
}

export interface ListConversationsInput {
  userId: string;
  limit: number;
  cursor?: string | null;
}

export interface ListConversationsResult {
  items: ConversationRecord[];
  nextCursor: string | null;
}

/** 会話一覧をupdatedAtの降順（同値はidの降順）で返す（実装指示書5章補足）。 */
export function listConversations(db: WhitefaceDb, input: ListConversationsInput): ListConversationsResult {
  const conditions = [eq(conversations.userId, input.userId)];

  if (input.cursor) {
    const cursor = decodeCursor(input.cursor);
    const beforeCursor = or(
      lt(conversations.updatedAt, cursor.updatedAt),
      and(eq(conversations.updatedAt, cursor.updatedAt), lt(conversations.id, cursor.id)),
    );
    if (beforeCursor) {
      conditions.push(beforeCursor);
    }
  }

  const rows = db
    .select()
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.updatedAt), desc(conversations.id))
    .limit(input.limit + 1)
    .all();

  const hasMore = rows.length > input.limit;
  const items = hasMore ? rows.slice(0, input.limit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last !== undefined ? encodeCursor({ updatedAt: last.updatedAt, id: last.id }) : null;

  return { items, nextCursor };
}
