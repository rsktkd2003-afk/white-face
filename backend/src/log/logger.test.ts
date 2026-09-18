// T-SEC-03（ロガー部分。実装指示書11章・3.9節）:
// APIキー、起動時トークン、Bearer xxxがロガー出力のいずれにも現れないことを確認する。
import { describe, expect, it } from 'vitest';
import { createRedactor } from '../security/redact.ts';
import { createLogger } from './logger.ts';

const FAKE_API_KEY = 'sk-ant-api03-FAKE-SECRET-VALUE-FOR-TEST-0001';
const FAKE_TOKEN = 'FAKE_STARTUP_TOKEN_abcdefghijklmnopqrstuvwxyz0123456789';

describe('T-SEC-03 ロガーの伏せ字（ロガー部分）', () => {
  it('メッセージに含まれるAPIキー・起動時トークンが出力に現れない', () => {
    const redact = createRedactor([FAKE_API_KEY, FAKE_TOKEN]);
    const lines: string[] = [];
    const logger = createLogger(redact, (line) => lines.push(line));

    logger.info(`起動しました。token=${FAKE_TOKEN} key=${FAKE_API_KEY}`);

    const output = lines.join('\n');
    expect(output).not.toContain(FAKE_API_KEY);
    expect(output).not.toContain(FAKE_TOKEN);
    expect(output).toContain('[REDACTED]');
  });

  it('metaオブジェクトに含まれる秘密情報も出力に現れない（ロガーの全出力が対象）', () => {
    const redact = createRedactor([FAKE_API_KEY, FAKE_TOKEN]);
    const lines: string[] = [];
    const logger = createLogger(redact, (line) => lines.push(line));

    logger.error('LLM呼び出しに失敗しました', {
      detail: `Authorization: Bearer ${FAKE_TOKEN}`,
      nested: { apiKey: FAKE_API_KEY },
    });

    const output = lines.join('\n');
    expect(output).not.toContain(FAKE_API_KEY);
    expect(output).not.toContain(FAKE_TOKEN);
  });

  it("'Bearer <値>' 形式は補助的な方式で伏せ字になる", () => {
    const redact = createRedactor([]);
    const lines: string[] = [];
    const logger = createLogger(redact, (line) => lines.push(line));

    logger.warn('Authorization: Bearer some-unknown-token-value');

    expect(lines.join('\n')).not.toContain('some-unknown-token-value');
  });

  it("'sk-ant-...' 形式は補助的な方式で伏せ字になる", () => {
    const redact = createRedactor([]);
    const lines: string[] = [];
    const logger = createLogger(redact, (line) => lines.push(line));

    logger.warn('key candidate: sk-ant-unregistered-example-key-000');

    expect(lines.join('\n')).not.toContain('sk-ant-unregistered-example-key-000');
  });
});
