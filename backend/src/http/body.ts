// M1 Step 5: 本文の読み取り（実装指示書3.4節手順5、POSTのみ）。
// Content-Typeがapplication/jsonでなければ415、本文が1 MiBを超える場合は413、
// JSONとして解析できない場合は400 VALIDATION_ERROR。
import type { IncomingMessage } from 'node:http';

const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB

export class UnsupportedMediaTypeError extends Error {}
export class PayloadTooLargeError extends Error {}
export class InvalidJsonError extends Error {}

/**
 * POST本文を読み取り、JSONとして解析して返す。
 * Content-Typeの確認 → サイズ確認 → JSON解析の順で検証する。
 */
export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const contentType = req.headers['content-type'];
  if (contentType === undefined || !contentType.toLowerCase().startsWith('application/json')) {
    throw new UnsupportedMediaTypeError('Content-Type は application/json である必要があります');
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  let tooLarge = false;

  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Buffer) => {
      if (tooLarge) {
        return;
      }
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        // ソケットを即座に破棄すると、クライアントが送信中の残りデータとの競合で
        // ECONNRESETになり413応答を受け取れないことがあるため、破棄せず読み捨てる。
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new PayloadTooLargeError('本文が1 MiBを超えています'));
      } else {
        resolve();
      }
    });
    req.on('error', (err) => reject(err instanceof Error ? err : new Error(String(err))));
  });

  const raw = Buffer.concat(chunks).toString('utf-8');
  if (raw.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new InvalidJsonError('本文をJSONとして解析できません');
  }
}
