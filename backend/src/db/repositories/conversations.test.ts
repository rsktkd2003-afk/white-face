// T-DB-02（実装指示書11章）: 会話の作成と一覧の並び順、cursorでの続きの取得。
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempDatabase } from '../../testing/tempDb.ts';
import type { TempDatabase } from '../../testing/tempDb.ts';
import { conversations } from '../schema.ts';
import { createConversation, listConversations } from './conversations.ts';

let temp: TempDatabase;

beforeEach(() => {
  temp = createTempDatabase();
});

afterEach(() => {
  temp.cleanup();
});

// 並び順・cursorのテストでは、時刻を厳密に制御するためリポジトリを経由せず
// 直接db.insertでセットアップする（作成そのものはcreateConversationのテストで別途検証する）。
function seedConversation(id: string, updatedAt: string): void {
  temp.db
    .insert(conversations)
    .values({
      id,
      userId: 'owner',
      title: `conversation-${id}`,
      createdAt: updatedAt,
      updatedAt,
    })
    .run();
}

describe('T-DB-02 会話の作成', () => {
  it('createConversationで作成した内容が実DBに保存される', () => {
    const record = createConversation(temp.db, { userId: 'owner', title: 'Hello' });

    expect(record.id).toHaveLength(26);
    expect(record.title).toBe('Hello');
    expect(record.createdAt).toBe(record.updatedAt);

    const conn = temp.openVerificationConnection();
    try {
      const row = conn.prepare('SELECT * FROM conversations WHERE id = ?').get(record.id) as
        | { id: string; user_id: string; title: string }
        | undefined;
      expect(row).toBeDefined();
      expect(row?.user_id).toBe('owner');
      expect(row?.title).toBe('Hello');
    } finally {
      conn.close();
    }
  });
});

describe('T-DB-02 会話一覧の並び順とcursor', () => {
  it('updatedAtの降順（同値はidの降順）で返る', () => {
    seedConversation('A', '2026-09-01T00:00:00.000Z');
    seedConversation('B', '2026-09-03T00:00:00.000Z');
    seedConversation('C', '2026-09-02T00:00:00.000Z');

    const result = listConversations(temp.db, { userId: 'owner', limit: 10 });

    expect(result.items.map((c) => c.id)).toEqual(['B', 'C', 'A']);
    expect(result.nextCursor).toBeNull();
  });

  it('limitを超える場合はnextCursorが返り、続きを取得すると残りが正しく得られる', () => {
    seedConversation('A', '2026-09-01T00:00:00.000Z');
    seedConversation('B', '2026-09-02T00:00:00.000Z');
    seedConversation('C', '2026-09-03T00:00:00.000Z');
    seedConversation('D', '2026-09-04T00:00:00.000Z');
    seedConversation('E', '2026-09-05T00:00:00.000Z');

    const page1 = listConversations(temp.db, { userId: 'owner', limit: 2 });
    expect(page1.items.map((c) => c.id)).toEqual(['E', 'D']);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = listConversations(temp.db, { userId: 'owner', limit: 2, cursor: page1.nextCursor });
    expect(page2.items.map((c) => c.id)).toEqual(['C', 'B']);
    expect(page2.nextCursor).not.toBeNull();

    const page3 = listConversations(temp.db, { userId: 'owner', limit: 2, cursor: page2.nextCursor });
    expect(page3.items.map((c) => c.id)).toEqual(['A']);
    expect(page3.nextCursor).toBeNull();

    // 全ページ合わせて重複・欠落がないこと
    const allIds = [...page1.items, ...page2.items, ...page3.items].map((c) => c.id);
    expect(allIds).toEqual(['E', 'D', 'C', 'B', 'A']);
  });

  it('updatedAtが同値の場合はidの降順で安定した順序になる', () => {
    const sameTime = '2026-09-10T00:00:00.000Z';
    seedConversation('A', sameTime);
    seedConversation('B', sameTime);
    seedConversation('C', sameTime);

    const page1 = listConversations(temp.db, { userId: 'owner', limit: 2 });
    expect(page1.items.map((c) => c.id)).toEqual(['C', 'B']);

    const page2 = listConversations(temp.db, { userId: 'owner', limit: 2, cursor: page1.nextCursor });
    expect(page2.items.map((c) => c.id)).toEqual(['A']);
  });

  it('他のuserIdの会話は一覧に含まれない', () => {
    seedConversation('A', '2026-09-01T00:00:00.000Z');
    temp.db
      .insert(conversations)
      .values({
        id: 'X',
        userId: 'someone-else',
        title: 'other user',
        createdAt: '2026-09-02T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z',
      })
      .run();

    const result = listConversations(temp.db, { userId: 'owner', limit: 10 });
    expect(result.items.map((c) => c.id)).toEqual(['A']);
  });
});
