// M1 Step 5: GET /api/health（実装指示書5章。認証不要、200 {status:"ok"}）。
import type { Route } from '../router.ts';
import { sendJson } from '../respond.ts';

export function createHealthRoute(): Route {
  return {
    method: 'GET',
    path: '/api/health',
    handler: ({ res }) => {
      sendJson(res, 200, { status: 'ok' });
    },
  };
}
