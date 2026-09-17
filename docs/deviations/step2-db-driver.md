# Step 2 approved deviation: DB接続方式の変更

- 状態: **Project Owner承認済み**
- 対象: M1実装指示書v1.2 8章（Drizzle と node:sqlite の接続）
- 記録日: 2026-09-17
- 目的: 正式仕様書（whiteface-m1-implementation-spec-v1.2.md）本体は書き換えず、
  将来v1.3等に反映する際の根拠として、変更内容と理由をここに記録する。

## 元仕様

- DB接続: `node:sqlite`（`DatabaseSync`）
- ORMドライバ: `drizzle-orm/sqlite-proxy`
- 接続数: 単一

## 変更後（承認済み）

- DB接続: `better-sqlite3@13.0.3`
- ORMドライバ: `drizzle-orm/better-sqlite3`
- 型定義: `@types/better-sqlite3@9.6.0`（better-sqlite3自体は型定義を同梱しないため追加）
- 接続数: 単一（変更なし）

## 変更理由

1. `drizzle-orm@0.45.2` + `sqlite-proxy` + `node:sqlite` の組み合わせで、
   実装指示書8.2節のT-TX-03・T-TX-04を実測した結果、再現性のある失敗を確認した。
   - T-TX-03: トランザクションA保留中にトランザクション外で行った挿入Bが、
     Aのロールバックに巻き込まれて消えた（sqlite-proxyを介さない生の`node:sqlite`
     でも同一の現象を再現。原因はsqlite-proxy自体ではなく、単一`DatabaseSync`接続の
     共有という構造にあることを実測で確認済み）。
   - T-TX-04: 2つ目の`db.transaction()`を試みた時点で、SQLite側から
     `cannot start a transaction within a transaction`という実行時エラーが発生した。
2. `drizzle-orm@0.45.2`には`node-sqlite`という名前のドライバは存在しない
   （`package.json`のexportsマップ、パッケージ全体の`grep`で確認。0件）。
3. `better-sqlite3`は同期ドライバであり、`drizzle-orm/better-sqlite3`の
   `transaction()`はbetter-sqlite3自身のネイティブtransaction機構
   （`Database.prototype.transaction()`）にそのまま委譲される。この機構は
   トランザクション関数が非同期（Promiseを返す）である場合を明示的に拒否する
   （実測: `Transaction function cannot return a promise`）。
   この同期性により、T-TX-03/T-TX-04が想定していた「トランザクションを非同期に
   保留したまま、別の処理を割り込ませる」という状況自体が構造的に発生し得なくなる
   （JavaScriptのシングルスレッド実行モデル上、同期関数の実行中は他のコードが
   一切割り込めないため）。

## 新しい受入条件（旧T-TX-03/T-TX-04を置き換える）

旧条件（非同期の一時停止を前提とする）は、採用した同期ドライバのアーキテクチャと
整合しないため廃止する。新条件は以下（`backend/src/db/client.test.ts`に実装）。

### 新T-TX-03

「失敗したtransactionのrollbackが、そのtransaction終了後の独立したDB操作へ
波及しないこと」を保証する。

1. トランザクションAを開始し、A内でINSERTする
2. 意図的に例外を発生させ、Aが完全にロールバックされることを確認する
3. A終了後、独立した通常操作Bを実行し、コミットする
4. 別接続からの確認により、Aのデータは存在せず、Bのデータは存在することを確認する

### 新T-TX-04a／T-TX-04b（nested transaction / SAVEPOINTの安全性）

- **T-TX-04a**: Outer transaction → INSERT A → Inner transaction → INSERT B →
  Inner成功 → Outer成功。結果: A・Bともに存在すること。
- **T-TX-04b**: Outer transaction → INSERT A → Inner transaction → INSERT B →
  Inner成功 → Outerで意図的に失敗。結果: A・Bともに存在しないこと
  （SAVEPOINTとして正しく親のロールバックに追随することの確認）。
- **T-TX-04c（追加）**: Outer transaction → INSERT A → Inner transactionのみ
  意図的に失敗 → OuterでInnerのエラーを捕捉し処理を継続 → Outer成功。
  結果: Aのみ存在し、Innerで試みた変更は存在しないこと
  （SAVEPOINTの独立ロールバックが、drizzle/better-sqlite3の正式APIで
  自然に表現できることの確認。独自workaroundなし）。

## 明確化: 満たせないままの制約

単一のDB接続上で、2つの完全に独立した（親子関係のない）write transactionを
同時に開くことは、`better-sqlite3`に限らずSQLiteの仕様上不可能である。
旧T-TX-04が意図した「独立して残るB」はこの意味で構造的に実現不可能であり、
今回の変更はこれを回避したのではなく、実現不可能な受入条件を、実際に
実現可能かつ意味のある受入条件（nested transaction / SAVEPOINTの安全性）に
置き換えたものである。
