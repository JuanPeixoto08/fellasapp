import { handle, type Env } from './handler.ts';

// Deno (Edge Function do Supabase); o tsc do app não conhece o Deno
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: { toObject: () => Record<string, string> };
};

Deno.serve((req) => handle(req, Deno.env.toObject() as unknown as Env));
