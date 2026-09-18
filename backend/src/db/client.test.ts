// M1 Step 2（承認済み変更）: better-sqlite3ベースのトランザクション実測テスト。
// T-DB-01、T-TX-01、T-TX-02a、T-TX-02b、T-TX-05は元の受入条件を維持。
// T-TX-03、T-TX-04は同期SQLiteドライバへの変更に伴い受入条件を改訂
// （docs/deviations/step2-db-driver.md「Step 2 approved deviation」参照）。
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempDatabase } from '../testing/tempDb.ts';
import type { TempDatabase } from '../testing/tempDb.ts';
import { createDatabase } from './client.ts';
import { conversations, messages } from './schema.ts';

let temp: TempDatabase;

beforeEach(() => {
  temp = createTempDatabase();
});

afterEach(() => {
  temp.cleanup();
});

function countConversations(): number {
  const conn = temp.openVerificationConnection();
  try {
    const row = conn.prepare('SELECT COUNT(*) as c FROM conversations').get() as { c: number };
    return Number(row.c);
  } finally {
    conn.close();
  }
}

function countMessages(): number {
  const conn = temp.openVerificationConnection();
  try {
    const row = conn.prepare('SELECT COUNT(*) as c FROM messages').get() as { c: number };
    return Number(row.c);
  } finally {
    conn.close();
  }
}

function existsConversation(id: string): boolean {
  const conn = temp.openVerificationConnection();
  try {
    return conn.prepare('SELECT 1 FROM conversations WHERE id = ?').get(id) !== undefined;
  } finally {
    conn.close();
  }
}

function newConversation(title: string) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    userId: 'owner',
    title,
    createdAt: now,
    updatedAt: now,
  };
}

function newMessage(conversationId: string, content: string) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    conversationId,
    userId: 'owner',
    role: 'user' as const,
    content,
    createdAt: now,
  };
}

describe('T-DB-01 マイグレーション', () => {
  it('空のDBに適用すると3つのテーブル(conversations/messages/llm_calls)が作られ、2回目の適用で何も変わらない', () => {
    const conn = temp.openVerificationConnection();
    try {
      const tables = conn
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'",
        )
        .all()
        .map((row) => (row as { name: string }).name)
        .sort();
      expect(tables).toEqual(['conversations', 'llm_calls', 'messages']);
    } finally {
      conn.close();
    }
  });

  it('createDatabaseを再度呼んでも(2回目のマイグレーション適用)エラーにならず内容が変わらない', () => {
    const before = countConversations();
    const second = createDatabase(temp.path);
    second.close();
    expect(countConversations()).toBe(before);
  });
});

describe('T-TX-01 コミットの確認', () => {
  it('db.transaction内で会話1件とメッセージ2件を挿入すると、別接続から見える', () => {
    const conv = newConversation('T-TX-01');
    const msg1 = newMessage(conv.id, 'hello');
    const msg2 = newMessage(conv.id, 'world');

    temp.db.transaction((tx) => {
      tx.insert(conversations).values(conv).run();
      tx.insert(messages).values(msg1).run();
      tx.insert(messages).values(msg2).run();
    });

    expect(countConversations()).toBe(1);
    expect(countMessages()).toBe(2);
  });
});

describe('T-TX-02a 明示的な失敗によるロールバック', () => {
  it('会話とメッセージを挿入した後にthrowすると、両方ロールバックされる', () => {
    const conv = newConversation('T-TX-02a');
    const msg = newMessage(conv.id, 'will be rolled back');

    expect(() => {
      temp.db.transaction((tx) => {
        tx.insert(conversations).values(conv).run();
        tx.insert(messages).values(msg).run();
        throw new Error('intentional');
      });
    }).toThrow('intentional');

    expect(countConversations()).toBe(0);
    expect(countMessages()).toBe(0);
  });
});

describe('T-TX-02b 外部キー違反によるロールバック', () => {
  it('存在しない会話IDを参照するメッセージ挿入で失敗し、会話も0件になる', () => {
    const conv = newConversation('T-TX-02b');
    const badMessage = newMessage(randomUUID(), 'orphan message');

    expect(() => {
      temp.db.transaction((tx) => {
        tx.insert(conversations).values(conv).run();
        tx.insert(messages).values(badMessage).run();
      });
    }).toThrow();

    expect(countConversations()).toBe(0);
    expect(countMessages()).toBe(0);
  });
});

describe('新T-TX-03 独立したDB操作への波及チェック（Step 2 approved deviation）', () => {
  it('失敗したトランザクションのロールバックが、終了後の独立した操作Bへ波及しない', () => {
    const convA = newConversation('T-TX-03-A');
    const convB = newConversation('T-TX-03-B');

    expect(() => {
      temp.db.transaction((tx) => {
        tx.insert(conversations).values(convA).run();
        throw new Error('intentional-A');
      });
    }).toThrow('intentional-A');

    // Aが完全に終了(ロールバック)した後に、独立した通常操作Bを実行してコミットする。
    temp.db.insert(conversations).values(convB).run();

    expect(existsConversation(convA.id)).toBe(false);
    expect(existsConversation(convB.id)).toBe(true);
  });
});

describe('新T-TX-04a nested transaction(outer成功・inner成功)（Step 2 approved deviation）', () => {
  it('outerとinnerがともに成功すると、AとBがともに存在する', () => {
    const convA = newConversation('T-TX-04a-A');
    const convB = newConversation('T-TX-04a-B');

    temp.db.transaction((outer) => {
      outer.insert(conversations).values(convA).run();
      outer.transaction((inner) => {
        inner.insert(conversations).values(convB).run();
      });
    });

    expect(existsConversation(convA.id)).toBe(true);
    expect(existsConversation(convB.id)).toBe(true);
  });
});

describe('新T-TX-04b nested transaction(outer失敗)（Step 2 approved deviation）', () => {
  it('innerが成功済みでも、outerが失敗するとSAVEPOINTごとロールバックされ両方消える', () => {
    const convA = newConversation('T-TX-04b-A');
    const convB = newConversation('T-TX-04b-B');

    expect(() => {
      temp.db.transaction((outer) => {
        outer.insert(conversations).values(convA).run();
        outer.transaction((inner) => {
          inner.insert(conversations).values(convB).run();
        });
        throw new Error('intentional-outer');
      });
    }).toThrow('intentional-outer');

    expect(existsConversation(convA.id)).toBe(false);
    expect(existsConversation(convB.id)).toBe(false);
  });
});

describe('新T-TX-04c inner単独の失敗とSAVEPOINTの独立ロールバック（追加・Step 2 approved deviation）', () => {
  it('innerのみ失敗してもouterでcatchして継続でき、innerの変更だけが消える', () => {
    const convA = newConversation('T-TX-04c-A');
    const convB = newConversation('T-TX-04c-B');
    let innerError: unknown = null;

    temp.db.transaction((outer) => {
      outer.insert(conversations).values(convA).run();
      try {
        outer.transaction((inner) => {
          inner.insert(conversations).values(convB).run();
          throw new Error('intentional-inner');
        });
      } catch (err) {
        innerError = err;
      }
    });

    expect(innerError).toBeInstanceOf(Error);
    expect(existsConversation(convA.id)).toBe(true);
    expect(existsConversation(convB.id)).toBe(false);
  });
});

describe('T-TX-05 成功・失敗の繰り返し', () => {
  it('成功と失敗を交互に100回繰り返すと、残る件数が成功回数と一致する', () => {
    let successCount = 0;
    for (let i = 0; i < 100; i++) {
      const shouldSucceed = i % 2 === 0;
      const conv = newConversation(`T-TX-05-${i}`);
      try {
        temp.db.transaction((tx) => {
          tx.insert(conversations).values(conv).run();
          if (!shouldSucceed) {
            throw new Error('intentional-loop');
          }
        });
        successCount += 1;
      } catch (err) {
        if (!(err instanceof Error) || err.message !== 'intentional-loop') {
          throw err;
        }
      }
    }

    expect(countConversations()).toBe(successCount);
  });
});
