// M1 Step 5: ルーティングの型定義。
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  body: unknown;
}

export type RouteHandler = (ctx: RouteContext) => void | Promise<void>;

export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
}
