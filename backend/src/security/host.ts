// M1 Step 5: Hostヘッダーの検証（実装指示書3.4節手順1）。
// 許可する値は127.0.0.1:{port}とlocalhost:{port}のみ（大文字小文字は区別しない）。
// Hostヘッダーがない場合も拒否する。

export function isAllowedHost(hostHeader: string | undefined, port: number): boolean {
  if (hostHeader === undefined) {
    return false;
  }
  const normalized = hostHeader.toLowerCase();
  return normalized === `127.0.0.1:${port}` || normalized === `localhost:${port}`;
}
