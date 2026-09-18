// M1 Step 3: 現在時刻・日本時間での月の範囲（実装指示書9章「月の範囲」）。
// 日本時間はUTC+9固定（夏時間なし）として扱う[仮定]。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 現在時刻を返す。後続Stepでのテスト容易性のために関数として提供する。 */
export function now(): Date {
  return new Date();
}

export interface JstMonthRange {
  /** 日本時間での年月（例: "2026-09"）。 */
  month: string;
  /** この月の開始時刻（UTC、ISO 8601、この時刻を含む）。 */
  startUtc: string;
  /** この月の終了時刻（UTC、ISO 8601、この時刻は含まない）。 */
  endUtc: string;
}

/**
 * 指定した時刻が属する「日本時間の暦月」の範囲を返す（実装指示書9章）。
 * 例: UTCの8月31日15:00は、日本時間で9月1日0:00のため9月分に含まれる。
 */
export function getJstMonthRange(date: Date): JstMonthRange {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const year = jst.getUTCFullYear();
  const monthIndex = jst.getUTCMonth();

  const startJstMs = Date.UTC(year, monthIndex, 1, 0, 0, 0, 0);
  const endJstMs = Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0);

  return {
    month: `${String(year)}-${String(monthIndex + 1).padStart(2, '0')}`,
    startUtc: new Date(startJstMs - JST_OFFSET_MS).toISOString(),
    endUtc: new Date(endJstMs - JST_OFFSET_MS).toISOString(),
  };
}
