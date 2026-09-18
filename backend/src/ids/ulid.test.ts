// T-ID-01（実装指示書11章）: ULIDは26文字で、同じミリ秒内でも昇順になる。
import { describe, expect, it } from 'vitest';
import { generateUlid } from './ulid.ts';

describe('T-ID-01 ULID', () => {
  it('26文字である', () => {
    expect(generateUlid()).toHaveLength(26);
  });

  it('Crockford base32の文字のみで構成される', () => {
    expect(generateUlid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('同じミリ秒内でも辞書順で昇順になる', () => {
    const fixedNow = Date.UTC(2026, 8, 17, 0, 0, 0, 0);
    const ids = Array.from({ length: 50 }, () => generateUlid(fixedNow));
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('時刻が異なれば、後の時刻のULIDの方が辞書順で後になる', () => {
    const earlier = generateUlid(Date.UTC(2026, 8, 17, 0, 0, 0, 0));
    const later = generateUlid(Date.UTC(2026, 8, 17, 0, 0, 0, 1));
    expect(earlier < later).toBe(true);
  });
});
