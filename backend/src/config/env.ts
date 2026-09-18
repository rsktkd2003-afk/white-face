// M1 Step 3: .envの読み込み（実装指示書3.1節手順1）。
// main.tsからの呼び出しはStep 5で配線する。

export class EnvFileNotFoundError extends Error {}

/**
 * 指定した絶対パスの.envを読み込む。ファイルがない場合は
 * わかりやすいメッセージを持つEnvFileNotFoundErrorを投げる（実装指示書3.1節手順1）。
 */
export function loadEnvFile(absolutePath: string): void {
  try {
    process.loadEnvFile(absolutePath);
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      throw new EnvFileNotFoundError(`.env が見つかりません: ${absolutePath}`);
    }
    throw err;
  }
}

/** ANTHROPIC_API_KEYを読み取る。値の必要性はStep 6のLLM呼び出し時に検証する。 */
export function getAnthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY;
}
