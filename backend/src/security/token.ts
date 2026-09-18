// M1 Step 5: 起動時トークン（実装指示書3.1節手順5、3.3節、3.4節手順4）。
import { randomBytes, timingSafeEqual } from 'node:crypto';

/** crypto.randomBytes(32)をbase64url形式にした起動時トークンを生成する（実装指示書3.1節手順5）。 */
export function generateStartupToken(): string {
  return randomBytes(32).toString('base64url');
}

const BEARER_PREFIX = 'Bearer ';

/**
 * Authorizationヘッダーが、期待するトークンと一致するか確認する。
 * 長さを確認したうえでcrypto.timingSafeEqualで比較する（実装指示書3.4節手順4）。
 */
export function isAuthorized(authorizationHeader: string | undefined, expectedToken: string): boolean {
  if (authorizationHeader === undefined || !authorizationHeader.startsWith(BEARER_PREFIX)) {
    return false;
  }
  const provided = authorizationHeader.slice(BEARER_PREFIX.length);
  const providedBuf = Buffer.from(provided, 'utf-8');
  const expectedBuf = Buffer.from(expectedToken, 'utf-8');
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}
