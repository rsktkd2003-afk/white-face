/**
 * Whiteface の状態（要件定義書 9.1）。
 * M1では STANDBY / THINKING / SPEAKING / ERROR のみ使用する（実装指示書1.1節）。
 * 残りはM2以降で実際に使用される。
 */
export type WhitefaceState =
  | 'STANDBY'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'MEMORY_ACCESS'
  | 'TOOL_EXECUTION'
  | 'AUTHORIZATION_WAIT'
  | 'ERROR';
