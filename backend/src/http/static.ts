// M1 Step 5: 静的配信（startモード）（実装指示書3.5節）。
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
} as const;

// %2e(.)、%2f(/)、%5c(\)のようなエンコードされた区切り文字を、生のURL文字列の
// 時点で拒否する（デコード後のpath.resolve判定だけに頼らない）。
const ENCODED_SEPARATOR_PATTERN = /%2e|%2f|%5c|\\/i;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function contentTypeFor(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function send404(res: ServerResponse): void {
  res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
}

/** frontend/distの中にあるファイルだけを返す（実装指示書3.5節）。 */
export function serveStatic(req: IncomingMessage, res: ServerResponse, distPath: string): void {
  const rawUrl = req.url ?? '/';
  const pathname = rawUrl.split('?')[0] ?? '/';

  if (ENCODED_SEPARATOR_PATTERN.test(rawUrl) || pathname.includes('..')) {
    send404(res);
    return;
  }

  const decoded = decodeURIComponent(pathname);
  if (decoded.includes('..') || ENCODED_SEPARATOR_PATTERN.test(decoded)) {
    send404(res);
    return;
  }

  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolvedDist = path.resolve(distPath);
  const resolvedFile = path.resolve(resolvedDist, relative);

  if (resolvedFile !== resolvedDist && !resolvedFile.startsWith(resolvedDist + path.sep)) {
    send404(res);
    return;
  }

  if (!existsSync(resolvedFile) || !statSync(resolvedFile).isFile()) {
    send404(res);
    return;
  }

  const isIndexHtml = path.relative(resolvedDist, resolvedFile) === 'index.html';
  const headers: Record<string, string> = {
    ...SECURITY_HEADERS,
    'Content-Type': contentTypeFor(resolvedFile),
  };
  if (isIndexHtml) {
    headers['Cache-Control'] = 'no-store';
  }

  res.writeHead(200, headers);
  createReadStream(resolvedFile).pipe(res);
}
