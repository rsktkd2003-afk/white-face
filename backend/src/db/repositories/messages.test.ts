// T-DB-02（実装指示書11章）: メッセージの挿入と取得（truncatedを含む）。
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempDatabase } from '../../testing/tempDb.ts';
import type { TempDatabase } from '../../testing/tempDb.ts';
import { createConversation } from './conversations.ts';
import { insertMessage, listMessagesByConversation } from './messages.ts';

let temp: TempDatabase;

beforeEach(() => {
  temp = createTempDatabase();
});

afterEach(() => {
  temp.cleanup();
});

describe('T-DB-02 メッセージの挿入と取得', () => {
  it('挿入したメッセージが実DBに保存され、取得できる', () => {
    const conversation = createConversation(temp.db, { userId: 'owner', title: 'T' });

    const message = insertMessage(temp.db, {
      conversationId: conversation.id,
      userId: 'owner',
      role: 'user',
      content: 'こんにちは',
    });

    expect(message.id).toHaveLength(26);
    expect(message.inputMethod).toBe('text');
    expect(message.truncated).toBe(false);

    const conn = temp.openVerificationConnection();
    try {
      const row = conn.prepare('SELECT * FROM messages WHERE id = ?').get(message.id) as
        | { content: string; truncated: number; input_method: string }
        | undefined;
      expect(row).toBeDefined();
      expect(row?.content).toBe('こんにちは');
      expect(row?.truncated).toBe(0);
      expect(row?.input_method).toBe('text');
    } finally {
      conn.close();
    }
  });

  it('truncated=trueで挿入すると、取得結果でもtruncatedがtrueになる', () => {
    const conversation = createConversation(temp.db, { userId: 'owner', title: 'T' });

    const message = insertMessage(temp.db, {
      conversationId: conversation.id,
      userId: 'owner',
      role: 'assistant',
      content: '途中まで',
      truncated: true,
    });

    expect(message.truncated).toBe(true);

    const [fetched] = listMessagesByConversation(temp.db, conversation.id);
    expect(fetched?.truncated).toBe(true);

    const conn = temp.openVerificationConnection();
    try {
      const row = conn.prepare('SELECT truncated FROM messages WHERE id = ?').get(message.id) as
        | { truncated: number }
        | undefined;
      expect(row?.truncated).toBe(1);
    } finally {
      conn.close();
    }
  });

  it('会話に属するメッセージをcreated_atの昇順で取得できる', () => {
    const conversation = createConversation(temp.db, { userId: 'owner', title: 'T' });

    const first = insertMessage(temp.db, {
      conversationId: conversation.id,
      userId: 'owner',
      role: 'user',
      content: '1つ目',
    });
    const second = insertMessage(temp.db, {
      conversationId: conversation.id,
      userId: 'owner',
      role: 'assistant',
      content: '2つ目',
    });

    const list = listMessagesByConversation(temp.db, conversation.id);
    expect(list.map((m) => m.id)).toEqual([first.id, second.id]);
  });

  it('存在しない会話IDを指定すると外部キー違反で失敗する', () => {
    expect(() =>
      insertMessage(temp.db, {
        conversationId: 'non-existent-conversation-id',
        userId: 'owner',
        role: 'user',
        content: 'orphan',
      }),
    ).toThrow();
  });
});
