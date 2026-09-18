// M1 Step 5: レスポンス送出の共通処理（実装指示書3.8節）。
import type { ServerResponse } from 'node:http';

export type ApiErrorCode =
  | 'HOST_NOT_ALLOWED'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR';

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

/** APIのエラー応答: { "error": { "code", "message" } }（実装指示書3.8節）。messageは日本語、秘密情報を含めない。 */
export function sendApiError(res: ServerResponse, status: number, code: ApiErrorCode, message: string): void {
  sendJson(res, status, { error: { code, message } });
}
