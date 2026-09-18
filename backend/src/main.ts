// M1 Step 5: 起動処理（実装指示書3.1節）。
import path from 'node:path';
import process from 'node:process';
import { loadConfig } from './config/appConfig.ts';
import { EnvFileNotFoundError, getAnthropicApiKey, loadEnvFile } from './config/env.ts';
import { createLogger } from './log/logger.ts';
import { createRedactor } from './security/redact.ts';
import { generateStartupToken } from './security/token.ts';
import { createDatabase } from './db/client.ts';
import { createGracefulShutdown, createHttpServer } from './http/server.ts';
import type { ServerMode } from './http/server.ts';
import { createHealthRoute } from './http/routes/health.ts';
import { createStateRoute } from './http/routes/state.ts';
import { createStateManager } from './state/stateManager.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const CONFIG_PATH = path.resolve(import.meta.dirname, '../config/whiteface.config.json');

function parseMode(argv: readonly string[]): ServerMode {
  const arg = argv.find((a) => a.startsWith('--mode='));
  const mode = arg?.slice('--mode='.length);
  if (mode === 'dev' || mode === 'start') {
    return mode;
  }
  throw new Error(`--mode には dev または start を指定してください（受け取った値: ${String(mode)}）`);
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));

  // 1. .envを読み込む（実装指示書3.1節手順1）。ファイルがない場合はわかりやすいメッセージで終了する。
  try {
    loadEnvFile(path.join(REPO_ROOT, '.env'));
  } catch (err) {
    if (err instanceof EnvFileNotFoundError) {
      console.error(err.message);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  // 2. config/whiteface.config.jsonを読み込み、型ガードで検証する（実装指示書3.1節手順2、3.2節）。
  const config = loadConfig(CONFIG_PATH);

  // 3. モデルIDが料金表にない場合は終了する（実装指示書3.1節手順3、6.5節）。
  //    料金表（llm/pricing.ts）はStep 6で実装するため、Step 5ではこの検証を行わない。
  //    Step 6で料金表を追加した際に、ここへ検証を追加する。

  const startupToken = generateStartupToken();
  const anthropicApiKey = getAnthropicApiKey();
  const redact = createRedactor([anthropicApiKey, startupToken]);
  const logger = createLogger(redact);

  // 4. DBを開き、マイグレーションを適用する（実装指示書3.1節手順4）。
  const database = createDatabase(config.database.path);

  const stateManager = createStateManager();

  const server = createHttpServer({
    port: config.server.port,
    mode,
    token: startupToken,
    distPath: config.frontend.distPath,
    routes: [createHealthRoute(), createStateRoute(stateManager)],
    logger,
  });

  const shutdown = createGracefulShutdown({ server, closeDatabase: database.close, logger });
  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((err: unknown) => {
      logger.error('SIGINT終了処理に失敗しました', { error: err instanceof Error ? err.message : String(err) });
      process.exit(1);
    });
  });
  process.on('SIGBREAK', () => {
    shutdown('SIGBREAK').catch((err: unknown) => {
      logger.error('SIGBREAK終了処理に失敗しました', { error: err instanceof Error ? err.message : String(err) });
      process.exit(1);
    });
  });

  // 6. 127.0.0.1:{port}で待ち受けを開始する（実装指示書3.1節手順6）。
  await new Promise<void>((resolve) => {
    server.listen(config.server.port, config.server.host, resolve);
  });

  // 7. 起動URLを表示する（実装指示書3.1節手順7、3.3節）。
  //    ロガーを通さずに標準出力へ直接書き出す、唯一の例外とする。
  console.log(`Whiteface: http://127.0.0.1:${config.server.port}/#token=${startupToken}`);
  console.log(`Whiteface (開発時): http://127.0.0.1:${config.server.devFrontendPort}/#token=${startupToken}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
