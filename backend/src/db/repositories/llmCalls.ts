// M1 Step 4: llm_callsのリポジトリ（実装指示書7章）。
// 料金計算・Anthropic API呼び出し（Step 6以降）はここでは実装しない。
import { generateUlid } from '../../ids/ulid.ts';
import type { WhitefaceDb } from '../client.ts';
import { llmCalls } from '../schema.ts';

export type LlmCallRecord = typeof llmCalls.$inferSelect;

// $inferInsertではestimated_cost_micro_usd等のDEFAULT付き列が省略可能型になり、
// 返り値（LlmCallRecord、全列必須）との整合が取れなくなるため使わない。
// 呼び出し側に全列を明示的に指定させる（default値への暗黙依存を避ける）。
export type CreateLlmCallInput = Omit<LlmCallRecord, 'id'>;

/**
 * llm_callsへ1行記録する。実装指示書7.3節「llm_callsへの記録は、トランザクションを
 * 使わず単独で書き込みます」のとおり、呼び出し側でdb.transaction()に含めないこと。
 */
export function createLlmCall(db: WhitefaceDb, input: CreateLlmCallInput): LlmCallRecord {
  const record: LlmCallRecord = { id: generateUlid(), ...input };
  db.insert(llmCalls).values(record).run();
  return record;
}
