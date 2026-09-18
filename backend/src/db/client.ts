// M1 Step 2（承認済み変更）: better-sqlite3 と Drizzle の接続境界。
// 元仕様（node:sqlite + sqlite-proxy）からの変更理由は
// docs/deviations/step2-db-driver.md を参照（Step 2 approved deviation）。
// better-sqlite3 を直接扱ってよいのは、このファイルとtesting/だけ（ESLintで制限）。
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, '../../drizzle');

/**
 * db/repositories/* が受け取る型。db.transaction()内で渡されるtxも同じ基底型を
 * 持つため、repositoryの各関数はdbとtxのどちらでもそのまま使える（実装指示書8.1節
 * 「リポジトリ層が扱うのはdbとスキーマだけ」）。
 */
export type WhitefaceDb = BaseSQLiteDatabase<'sync', Database.RunResult>;

export interface WhitefaceDatabaseHandle {
  db: WhitefaceDb;
  close: () => void;
}

/**
 * DBを開き、PRAGMAを設定し、マイグレーションを適用した状態のハンドルを返す。
 * マイグレーションの適用（BEGIN/COMMIT/ROLLBACK）はdrizzle-orm/better-sqlite3/migratorが
 * 同期的に行う（sqlite-core/dialect.jsのmigrate()がsession.run(BEGIN/COMMIT/ROLLBACK)を発行する）。
 */
export function createDatabase(dbPath: string): WhitefaceDatabaseHandle {
  const sqlite = new Database(dbPath);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');

  const db = drizzle(sqlite);

  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return {
    db,
    close: () => {
      sqlite.close();
    },
  };
}
