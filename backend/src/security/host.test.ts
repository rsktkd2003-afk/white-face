// security/host.ts の単体テスト（実装指示書3.4節手順1）。
import { describe, expect, it } from 'vitest';
import { isAllowedHost } from './host.ts';

describe('isAllowedHost', () => {
  it('127.0.0.1:{port}を許可する', () => {
    expect(isAllowedHost('127.0.0.1:8787', 8787)).toBe(true);
  });

  it('localhost:{port}を許可する', () => {
    expect(isAllowedHost('localhost:8787', 8787)).toBe(true);
  });

  it('大文字小文字を区別しない', () => {
    expect(isAllowedHost('LOCALHOST:8787', 8787)).toBe(true);
  });

  it('Hostヘッダーがない場合は拒否する', () => {
    expect(isAllowedHost(undefined, 8787)).toBe(false);
  });

  it('未知のホスト名は拒否する', () => {
    expect(isAllowedHost('evil.example:8787', 8787)).toBe(false);
  });

  it('ポートが異なる場合は拒否する', () => {
    expect(isAllowedHost('127.0.0.1:9999', 8787)).toBe(false);
  });
});
