// M1 Step 4: メッセージのリポジトリ（実装指示書7章）。
import { asc, eq } from 'drizzle-orm';
import { generateUlid } from '../../ids/ulid.ts';
import { now } from '../../time/clock.ts';
import type { WhitefaceDb } from '../client.ts';
import { messages } from '../schema.ts';

export type MessageRecord = typeof messages.$inferSelect;

export interface InsertMessageInput {
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  inputMethod?: 'text' | 'voice';
  truncated?: boolean;
}

/** メッセージを1件挿入する。id・created_atはここで採番する。 */
export function insertMessage(db: WhitefaceDb, input: InsertMessageInput): MessageRecord {
  const record: MessageRecord = {
    id: generateUlid(),
    conversationId: input.conversationId,
    userId: input.userId,
    role: input.role,
    content: input.content,
    inputMethod: input.inputMethod ?? 'text',
    truncated: input.truncated ?? false,
    createdAt: now().toISOString(),
  };
  db.insert(messages).values(record).run();
  return record;
}

/** 会話に属するメッセージをcreated_atの昇順（同値はidの昇順）で返す。 */
export function listMessagesByConversation(db: WhitefaceDb, conversationId: string): MessageRecord[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .all();
}
