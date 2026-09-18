// M1 Step 5: T-SEC-01、02、04、05、06（実装指示書11章・3章）。
// 実際にlisten socketを127.0.0.1の一時portで使い、外部ネットワークへは接続しない。
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { connect } from 'node:net';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRedactor } from '../security/redact.ts';
import { createLogger } from '../log/logger.ts';
import { createHealthRoute } from './routes/health.ts';
import { createStateRoute } from './routes/state.ts';
import { createStateManager } from '../state/stateManager.ts';
import { createGracefulShutdown, createHttpServer } from './server.ts';
import type { ServerMode } from './server.ts';

const TOKEN = 'test-startup-token-0123456789abcdef';

interface RequestOptions {
  method?: string;
  path?: string;
  host?: string;
  authorization?: string | null;
  headers?: Record<string, string>;
  body?: string;
}

interface RequestResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function request(port: number, options: RequestOptions = {}): Promise<RequestResult> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { ...options.headers };
    if (options.host !== undefined) {
      headers.Host = options.host;
    }
    if (options.authorization !== undefined && options.authorization !== null) {
      headers.Authorization = options.authorization;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: options.path ?? '/api/health',
        method: options.method ?? 'GET',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      },
    );
    req.on('error', reject);
    if (options.body !== undefined) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * node:httpのクライアントは常に何らかのHostヘッダーを自動生成してしまうため、
 * 「Hostヘッダーが全くない」状態は生ソケットでHTTPリクエストを直接組み立てて再現する。
 */
function requestWithoutHostHeader(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', () => {
      // HTTP/1.1はHostヘッダー必須のためNode自身が400で弾んでしまう。
      // アプリケーション側のHost検証(403)を確認するため、Host省略が許されるHTTP/1.0で送る。
      socket.write(`GET ${path} HTTP/1.0\r\nConnection: close\r\n\r\n`);
    });
    let raw = '';
    socket.on('data', (chunk: Buffer) => {
      raw += chunk.toString('utf-8');
    });
    socket.on('end', () => {
      const [statusLine = '', ...rest] = raw.split('\r\n');
      const match = /^HTTP\/1\.[01] (\d{3})/.exec(statusLine);
      if (!match?.[1]) {
        reject(new Error(`ステータス行を解析できません: ${statusLine}`));
        return;
      }
      const body = rest.slice(rest.indexOf('') + 1).join('\r\n');
      resolve({ status: Number(match[1]), body });
    });
    socket.on('error', reject);
  });
}

let distDir: string;

beforeEach(() => {
  distDir = mkdtempSync(path.join(os.tmpdir(), 'wf-static-'));
  writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><title>Whiteface</title>');
  writeFileSync(path.join(distDir, 'app.js'), 'console.log("app");');
});

afterEach(() => {
  rmSync(distDir, { recursive: true, force: true });
});

async function startServer(mode: ServerMode): Promise<{ server: http.Server; port: number }> {
  const logger = createLogger(createRedactor([TOKEN]), () => {
    // テストではログ出力先を無視する
  });
  const stateManager = createStateManager();

  // Host検証はcreateHttpServerに渡したportと実際の待受portが一致している必要があるため、
  // 先に一時portを確保してから、そのportでcreateHttpServerを構成する。
  const freePort = await reserveFreePort();

  const server = createHttpServer({
    port: freePort,
    mode,
    token: TOKEN,
    distPath: distDir,
    routes: [createHealthRoute(), createStateRoute(stateManager)],
    logger,
  });

  return new Promise((resolve) => {
    server.listen(freePort, '127.0.0.1', () => {
      resolve({ server, port: freePort });
    });
  });
}

function reserveFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = http.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address() as AddressInfo;
      probe.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(address.port);
        }
      });
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe('T-SEC-04 待ち受けアドレス', () => {
  it('server.address()が127.0.0.1である', async () => {
    const { server, port } = await startServer('start');
    try {
      const address = server.address() as AddressInfo;
      expect(address.address).toBe('127.0.0.1');
      expect(port).toBeGreaterThan(0);
    } finally {
      await closeServer(server);
    }
  });
});

describe('T-SEC-02 Host検証', () => {
  it('Hostがない場合は403 HOST_NOT_ALLOWED', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await requestWithoutHostHeader(port, '/api/health');
      expect(res.status).toBe(403);
      expect(res.body).toContain('HOST_NOT_ALLOWED');
    } finally {
      await closeServer(server);
    }
  });

  it('evil.example:8787は拒否される(403)', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, { host: 'evil.example:8787' });
      expect(res.status).toBe(403);
    } finally {
      await closeServer(server);
    }
  });

  it('ポートが違う場合は拒否される(403)', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, { host: `127.0.0.1:${port + 1}` });
      expect(res.status).toBe(403);
    } finally {
      await closeServer(server);
    }
  });

  it('localhost:{port}は許可される', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, { host: `localhost:${port}` });
      expect(res.status).toBe(200);
    } finally {
      await closeServer(server);
    }
  });

  it('127.0.0.1:{port}は許可される（大文字小文字を区別しない）', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, { host: `127.0.0.1:${port}`.toUpperCase() });
      expect(res.status).toBe(200);
    } finally {
      await closeServer(server);
    }
  });
});

describe('T-SEC-01 トークン', () => {
  it('Authorizationヘッダーなしは401', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, { host: `127.0.0.1:${port}`, path: '/api/state' });
      expect(res.status).toBe(401);
      expect(JSON.parse(res.body)).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    } finally {
      await closeServer(server);
    }
  });

  it('不正な値は401', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, {
        host: `127.0.0.1:${port}`,
        path: '/api/state',
        authorization: 'Bearer wrong-token-value',
      });
      expect(res.status).toBe(401);
    } finally {
      await closeServer(server);
    }
  });

  it('長さ違いは401', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, {
        host: `127.0.0.1:${port}`,
        path: '/api/state',
        authorization: `Bearer ${TOKEN}extra`,
      });
      expect(res.status).toBe(401);
    } finally {
      await closeServer(server);
    }
  });

  it('正しいトークンは200', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, {
        host: `127.0.0.1:${port}`,
        path: '/api/state',
        authorization: `Bearer ${TOKEN}`,
      });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toMatchObject({ state: 'STANDBY', lastError: null });
    } finally {
      await closeServer(server);
    }
  });

  it('/api/healthはトークンなしでも200', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, { host: `127.0.0.1:${port}`, path: '/api/health' });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
    } finally {
      await closeServer(server);
    }
  });
});

describe('T-SEC-05 静的配信', () => {
  it('startモードで/にアクセスするとindex.htmlが返る', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, { host: `127.0.0.1:${port}`, path: '/' });
      expect(res.status).toBe(200);
      expect(res.body).toContain('Whiteface');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
    } finally {
      await closeServer(server);
    }
  });

  it('dist内の通常ファイルはCache-Control: no-storeを付けない', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, { host: `127.0.0.1:${port}`, path: '/app.js' });
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBeUndefined();
    } finally {
      await closeServer(server);
    }
  });

  it('..を含むパスはdistの外を読めず404になる', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, {
        host: `127.0.0.1:${port}`,
        path: '/../../../../../../etc/passwd',
      });
      expect(res.status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });

  it('エンコードされた区切り文字(%2e%2e%2f)を含むパスも404になる', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, {
        host: `127.0.0.1:${port}`,
        path: '/%2e%2e%2fapp.js',
      });
      expect(res.status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });

  it('devモードでは静的配信が404になる', async () => {
    const { server, port } = await startServer('dev');
    try {
      const res = await request(port, { host: `127.0.0.1:${port}`, path: '/' });
      expect(res.status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });
});

describe('T-SEC-06 本文', () => {
  it('1 MiBを超えると413', async () => {
    const { server, port } = await startServer('start');
    try {
      const largeBody = randomBytes(1024 * 1024 + 10).toString('base64');
      const res = await request(port, {
        host: `127.0.0.1:${port}`,
        path: '/api/health',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: largeBody,
      });
      expect(res.status).toBe(413);
      expect(JSON.parse(res.body)).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
    } finally {
      await closeServer(server);
    }
  });

  it('Content-Type違いで415', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, {
        host: `127.0.0.1:${port}`,
        path: '/api/health',
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: '{}',
      });
      expect(res.status).toBe(415);
      expect(JSON.parse(res.body)).toMatchObject({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } });
    } finally {
      await closeServer(server);
    }
  });

  it('JSON不正で400', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, {
        host: `127.0.0.1:${port}`,
        path: '/api/health',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not-json',
      });
      expect(res.status).toBe(400);
      expect(JSON.parse(res.body)).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await closeServer(server);
    }
  });
});

describe('未定義route', () => {
  it('存在しないパスは404', async () => {
    const { server, port } = await startServer('start');
    try {
      const res = await request(port, {
        host: `127.0.0.1:${port}`,
        path: '/api/no-such-route',
        authorization: `Bearer ${TOKEN}`,
      });
      expect(res.status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });
});

describe('Graceful shutdown（実装指示書3.10節）', () => {
  it('server.close()とDBのcloseが呼ばれる', async () => {
    const { server } = await startServer('start');
    let dbClosed = false;
    const logger = createLogger(createRedactor([]), () => {
      // ログは無視
    });
    const shutdown = createGracefulShutdown({
      server,
      closeDatabase: () => {
        dbClosed = true;
      },
      logger,
    });

    await shutdown('SIGINT');

    expect(dbClosed).toBe(true);
  });

  it('2回呼んでもエラーにならない（多重shutdown防止）', async () => {
    const { server } = await startServer('start');
    let closeCount = 0;
    const logger = createLogger(createRedactor([]), () => {
      // ログは無視
    });
    const shutdown = createGracefulShutdown({
      server,
      closeDatabase: () => {
        closeCount += 1;
      },
      logger,
    });

    await shutdown('SIGINT');
    await shutdown('SIGINT');

    expect(closeCount).toBe(1);
  });
});
