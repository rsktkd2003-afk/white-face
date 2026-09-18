// M1 Step 5: GET /api/state（実装指示書5章。認証必要、200 {state, lastError}）。
import type { StateManager } from '../../state/stateManager.ts';
import type { Route } from '../router.ts';
import { sendJson } from '../respond.ts';

export function createStateRoute(stateManager: StateManager): Route {
  return {
    method: 'GET',
    path: '/api/state',
    handler: ({ res }) => {
      sendJson(res, 200, stateManager.getSnapshot());
    },
  };
}
