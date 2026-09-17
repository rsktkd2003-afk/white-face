# Whiteface

自分専用のパーソナルAI「Whiteface」。詳細な仕様は `docs/whiteface-requirements-v1.0.md`
（要件定義書）と `docs/whiteface-m1-implementation-spec-v1.2.md`（M1実装指示書）を参照。

現在の状態: **M1 Step 1（骨組み）まで実装済み**。会話・LLM呼び出し・DB接続などの実際の機能は
まだ実装されていない。

## 前提

- Node.js `>=24.19.0`
- npm `11.17.0` 系

## セットアップ

```bash
npm install
cp .env.example .env
# .env を編集し、ANTHROPIC_API_KEY に自分のAPIキーを設定する
```

## 主なコマンド

```bash
npm run typecheck   # 全workspaceの型チェック
npm run lint        # ESLint
npm run test        # Vitest
npm run build       # 全workspaceのビルド（frontendのみ成果物を生成）
npm run verify      # typecheck → lint → test → build を順に実行

npm run dev:backend   # Backendを開発モードで起動（未実装）
npm run dev:frontend  # Frontendの開発サーバーを起動（未実装）
npm run start         # Frontendをビルドし、Backendで静的配信（未実装）
```

## Windows環境について

正式な実装環境はWindowsを前提としている。Linux上での実装・確認は、Linuxで確認できる範囲に
限られる。Windows固有の挙動（シグナル処理など）は、Windows実機で別途確認が必要。
