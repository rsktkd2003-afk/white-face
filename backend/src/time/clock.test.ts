// T-BUD-02（実装指示書11章）: UTCの8月31日15:00は、日本時間で9月分に含まれる。
import { describe, expect, it } from 'vitest';
import { getJstMonthRange } from './clock.ts';

describe('T-BUD-02 予算の月境界', () => {
  it('UTCの8月31日15:00は、日本時間で9月分に含まれる', () => {
    const date = new Date('2026-08-31T15:00:00.000Z');
    const range = getJstMonthRange(date);
    expect(range.month).toBe('2026-09');
  });

  it('UTCの8月31日14:59:59.999は、日本時間でまだ8月分である', () => {
    const date = new Date('2026-08-31T14:59:59.999Z');
    const range = getJstMonthRange(date);
    expect(range.month).toBe('2026-08');
  });

  it('月の開始・終了時刻(UTC)が正しい', () => {
    const date = new Date('2026-09-15T00:00:00.000Z');
    const range = getJstMonthRange(date);
    // 日本時間9/1 00:00 = UTC 8/31 15:00
    expect(range.startUtc).toBe('2026-08-31T15:00:00.000Z');
    // 日本時間10/1 00:00 = UTC 9/30 15:00
    expect(range.endUtc).toBe('2026-09-30T15:00:00.000Z');
  });
});
