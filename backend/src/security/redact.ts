// M1 Step 3: 秘密情報の伏せ字処理（実装指示書3.9節）。
const REDACTED = '[REDACTED]';

// 補助的な方式[仮定]。キーの正確な形式は未確認のため補助として扱う（実装指示書3.9節）。
const BEARER_PATTERN = /Bearer\s+\S+/g;
const ANTHROPIC_KEY_PATTERN = /sk-ant-[A-Za-z0-9_-]+/g;

export type Redactor = (text: string) => string;

/**
 * 起動時に読み込んだ秘密値（ANTHROPIC_API_KEY等）と起動時トークンを
 * 完全一致で[REDACTED]に置き換えるRedactorを作る（実装指示書3.9節「主な方式」）。
 * 加えて、Bearer <token>形式・sk-ant-...形式も補助的に置き換える。
 */
export function createRedactor(secrets: readonly (string | undefined)[]): Redactor {
  const knownSecrets = secrets.filter((s): s is string => typeof s === 'string' && s.length > 0);

  return (text: string): string => {
    let result = text;
    for (const secret of knownSecrets) {
      result = result.split(secret).join(REDACTED);
    }
    result = result.replace(BEARER_PATTERN, REDACTED);
    result = result.replace(ANTHROPIC_KEY_PATTERN, REDACTED);
    return result;
  };
}
