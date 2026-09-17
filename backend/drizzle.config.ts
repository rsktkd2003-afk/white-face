// M1 Step 2: DBに接続せずマイグレーションSQLを生成するためのdrizzle-kit設定（実装指示書16章 0.4節）。
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
