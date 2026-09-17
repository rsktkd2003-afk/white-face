// テスト補助: os.tmpdir()に実ファイルのDBを作成する（実装指示書8.2節）。
// better-sqlite3を直接扱ってよいのは、このファイルとdb/client.tsだけ（ESLintで制限）。
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createDatabase } from '../db/client.ts';
import type { WhitefaceDatabaseHandle } from '../db/client.ts';

export interface TempDatabase extends WhitefaceDatabaseHandle {
  path: string;
  /** 別途開いた確認用の読み取り専用接続を返す（呼び出し側で使用後にcloseすること）。 */
  openVerificationConnection: () => Database.Database;
  /** DBファイル・-wal・-shm・一時ディレクトリを削除する。 */
  cleanup: () => void;
}

export function createTempDatabase(): TempDatabase {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'whiteface-test-'));
  const dbPath = path.join(dir, `${randomUUID()}.db`);
  const handle = createDatabase(dbPath);

  return {
    db: handle.db,
    path: dbPath,
    close: handle.close,
    openVerificationConnection: () => new Database(dbPath, { readonly: true }),
    cleanup: () => {
      handle.close();
      for (const suffix of ['', '-wal', '-shm']) {
        rmSync(dbPath + suffix, { force: true });
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
