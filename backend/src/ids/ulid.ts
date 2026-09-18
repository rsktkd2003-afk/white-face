// M1 Step 3: ULID（実装指示書7.1節「node:cryptoを使って自作し、
// 同じミリ秒内でも順序が保たれるようにする」。ライブラリは追加しない[決定]）。
import { randomBytes } from 'node:crypto';

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32（I,L,O,Uを除く）
const TIME_CHARS = 10; // 48ビットの時刻を10文字（50ビット）で符号化
const RANDOM_CHARS = 16; // 80ビットの乱数を16文字で符号化
const RANDOM_BITS = 80n;
const RANDOM_MAX = (1n << RANDOM_BITS) - 1n;

function encode(value: bigint, chars: number): string {
  let result = '';
  let v = value;
  for (let i = 0; i < chars; i++) {
    result = ENCODING[Number(v & 31n)] + result;
    v >>= 5n;
  }
  return result;
}

function randomBigInt(bits: bigint): bigint {
  const byteLength = Number(bits / 8n);
  const bytes = randomBytes(byteLength);
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  return value;
}

let lastTimeMs = -1;
let lastRandom = 0n;

/**
 * ULID（26文字）を生成する。同じミリ秒内で連続して呼び出された場合は、
 * 乱数部分を1ずつ増やすことで辞書順が単調増加になるようにする（モノトニックULID）。
 * @param now テスト用に現在時刻を固定できる（省略時はDate.now()）。
 */
export function generateUlid(now: number = Date.now()): string {
  if (now === lastTimeMs) {
    lastRandom += 1n;
    if (lastRandom > RANDOM_MAX) {
      // 同一ミリ秒内で乱数部分が溢れることは実運用上まず起こらないが、
      // 発生した場合は時刻を1ミリ秒進めて採番を続ける。
      lastTimeMs += 1;
      lastRandom = randomBigInt(RANDOM_BITS);
    }
  } else {
    lastTimeMs = now;
    lastRandom = randomBigInt(RANDOM_BITS);
  }

  return encode(BigInt(lastTimeMs), TIME_CHARS) + encode(lastRandom, RANDOM_CHARS);
}
