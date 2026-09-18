// M1 Step 5: 状態管理（実装指示書9章、要件定義書9.1）。
// M1で実際に使用するのはSTANDBY / THINKING / SPEAKING / ERRORのみ（実装指示書1.1節）。
import type { WhitefaceState } from '@whiteface/shared';

export interface StateError {
  code: string;
  message: string;
}

export interface StateSnapshot {
  state: WhitefaceState;
  lastError: StateError | null;
}

export interface StateManager {
  getSnapshot: () => StateSnapshot;
  setState: (state: WhitefaceState) => void;
  setError: (error: StateError) => void;
  clearError: () => void;
}

/** 起動時の状態はSTANDBYとする。 */
export function createStateManager(): StateManager {
  let current: WhitefaceState = 'STANDBY';
  let lastError: StateError | null = null;

  return {
    getSnapshot: () => ({ state: current, lastError }),
    setState: (state) => {
      current = state;
    },
    setError: (error) => {
      current = 'ERROR';
      lastError = error;
    },
    clearError: () => {
      lastError = null;
    },
  };
}
