// M1 Step 5: HTTPサーバー本体（実装指示書3.4節「リクエスト処理の順序」）。
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Logger } from '../log/logger.ts';
import { isAllowedHost } from '../security/host.ts';
import { isAuthorized } from '../security/token.ts';
import { InvalidJsonError, PayloadTooLargeError, readJsonBody, UnsupportedMediaTypeError } from './body.ts';
import type { Route } from './router.ts';
import { sendApiError } from './respond.ts';
import { serveStatic } from './static.ts';

export type ServerMode = 'dev' | 'start';

export interface ServerOptions {
  port: number;
  mode: ServerMode;
  token: string;
  distPath: string;
  routes: Route[];
  logger: Logger;
}

/** ノード標準のhttp.createServerのみを使う（フレームワークを追加しない）。 */
export function createHttpServer(options: ServerOptions): Server {
  const routeMap = new Map(options.routes.map((route) => [`${route.method} ${route.path}`, route]));

  return createServer((req, res) => {
    handleRequest(req, res, options, routeMap).catch((err: unknown) => {
      options.logger.error('リクエスト処理中に予期しないエラーが発生しました', {
        error: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        sendApiError(res, 500, 'INTERNAL_ERROR', '内部エラーが発生しました');
      } else {
        res.end();
      }
    });
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: ServerOptions,
  routeMap: Map<string, Route>,
): Promise<void> {
  // 1. Host検証
  if (!isAllowedHost(req.headers.host, options.port)) {
    sendApiError(res, 403, 'HOST_NOT_ALLOWED', '許可されていないHostです');
    return;
  }

  // 2. リクエスト先の検証
  const url = req.url ?? '';
  if (!url.startsWith('/')) {
    sendApiError(res, 400, 'VALIDATION_ERROR', '不正なリクエストです');
    return;
  }
  const pathname = url.split('?')[0] ?? '/';

  // 3. 振り分け
  if (!pathname.startsWith('/api/')) {
    if (options.mode !== 'start') {
      sendApiError(res, 404, 'NOT_FOUND', '見つかりません');
      return;
    }
    serveStatic(req, res, options.distPath);
    return;
  }

  // 4. API認証（/api/health以外）
  if (pathname !== '/api/health' && !isAuthorized(req.headers.authorization, options.token)) {
    sendApiError(res, 401, 'UNAUTHORIZED', '認証が必要です');
    return;
  }

  // 5. 本文の読み取り（POSTのみ）
  let body: unknown;
  if (req.method === 'POST') {
    try {
      body = await readJsonBody(req);
    } catch (err) {
      if (err instanceof UnsupportedMediaTypeError) {
        sendApiError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', err.message);
      } else if (err instanceof PayloadTooLargeError) {
        sendApiError(res, 413, 'PAYLOAD_TOO_LARGE', err.message);
      } else if (err instanceof InvalidJsonError) {
        sendApiError(res, 400, 'VALIDATION_ERROR', err.message);
      } else {
        throw err;
      }
      return;
    }
  }

  // 6. CORS: CORS関連のヘッダーは一切付けない（意図的に何もしない）。

  const route = routeMap.get(`${req.method ?? ''} ${pathname}`);
  if (!route) {
    sendApiError(res, 404, 'NOT_FOUND', '見つかりません');
    return;
  }

  await route.handler({ req, res, body });
}

export interface GracefulShutdownDeps {
  server: Server;
  closeDatabase: () => void;
  logger: Logger;
  /** 強制終了までの待ち時間（既定5000ms、実装指示書3.10節）。 */
  timeoutMs?: number;
}

/**
 * Graceful shutdown（実装指示書3.10節）。
 * 1. 新しい接続の受け付けを止める（server.close()が兼ねる）
 * 2. 実行中のLLM呼び出しを中断する（M1 Step5時点ではLLM呼び出しが存在しないため対象なし。Step6以降で接続する）
 * 3. SSE接続を閉じる（M1 Step5時点ではSSEが存在しないため対象なし。Step8/9以降で接続する）
 * 4. server.close()を呼ぶ
 * 5. DBを閉じる
 * 5秒以内に終わらない場合は強制的に終了する。
 */
export function createGracefulShutdown(deps: GracefulShutdownDeps): (signal: string) => Promise<void> {
  const timeoutMs = deps.timeoutMs ?? 5000;
  let shuttingDown = false;

  return async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    deps.logger.info(`シグナル(${signal})を受信しました。終了処理を開始します。`);

    const forceExitTimer = setTimeout(() => {
      deps.logger.error('終了処理が時間内に完了しなかったため強制終了します');
      process.exit(1);
    }, timeoutMs);

    try {
      await new Promise<void>((resolve, reject) => {
        deps.server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      deps.closeDatabase();
      deps.logger.info('終了処理が完了しました');
    } finally {
      clearTimeout(forceExitTimer);
    }
  };
}
