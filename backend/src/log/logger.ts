// M1 Step 3: ロガー（実装指示書3.9節「伏せ字処理を通す対象：ロガーの全出力」）。
// 出力先は標準出力のみ。M1ではログファイルを作らない（実装指示書3.9節）。
import type { Redactor } from '../security/redact.ts';

export type LogLevel = 'info' | 'warn' | 'error';

export interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

export type LogWriter = (line: string) => void;

function redactDeep(value: unknown, redact: Redactor): unknown {
  if (typeof value === 'string') {
    return redact(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, redact));
  }
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      result[key] = redactDeep(v, redact);
    }
    return result;
  }
  return value;
}

/**
 * ロガーを作る。redactは全出力（message・meta）に適用する。
 * writerの既定値はconsole.log（標準出力）。テストでは差し替えて出力を検証する。
 */
export function createLogger(redact: Redactor, writer: LogWriter = (line) => console.log(line)): Logger {
  function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry = {
      level,
      timestamp: new Date().toISOString(),
      message: redact(message),
      ...(meta === undefined ? {} : { meta: redactDeep(meta, redact) }),
    };
    writer(JSON.stringify(entry));
  }

  return {
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
  };
}
