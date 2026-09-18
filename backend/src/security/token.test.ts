// security/token.ts の単体テスト（実装指示書3.1節手順5、3.4節手順4）。
import { describe, expect, it } from 'vitest';
import { generateStartupToken, isAuthorized } from './token.ts';

describe('generateStartupToken', () => {
  it('呼び出すたびに異なるトークンを生成する', () => {
    const a = generateStartupToken();
    const b = generateStartupToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('isAuthorized', () => {
  const token = 'abcDEF123-_xyz';

  it('正しいBearerトークンはtrue', () => {
    expect(isAuthorized(`Bearer ${token}`, token)).toBe(true);
  });

  it('ヘッダーがない場合はfalse', () => {
    expect(isAuthorized(undefined, token)).toBe(false);
  });

  it('Bearerプレフィックスがない場合はfalse', () => {
    expect(isAuthorized(token, token)).toBe(false);
  });

  it('値が異なる場合はfalse', () => {
    expect(isAuthorized('Bearer wrong-value', token)).toBe(false);
  });

  it('長さが異なる場合はfalse', () => {
    expect(isAuthorized(`Bearer ${token}extra`, token)).toBe(false);
    expect(isAuthorized('Bearer short', token)).toBe(false);
  });
});
