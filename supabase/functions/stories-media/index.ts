import { handle, type Env } from './handler.ts';

// Deno (Edge Function do Supabase); o tsc do app não conhece o Deno
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

const get = (key: keyof Env) => Deno.env.get(key) ?? '';

Deno.serve((req) =>
  handle(req, {
    SUPABASE_URL: get('SUPABASE_URL'),
    SUPABASE_ANON_KEY: get('SUPABASE_ANON_KEY'),
    CLOUDINARY_CLOUD_NAME: get('CLOUDINARY_CLOUD_NAME'),
    CLOUDINARY_API_KEY: get('CLOUDINARY_API_KEY'),
    CLOUDINARY_API_SECRET: get('CLOUDINARY_API_SECRET'),
    STORIES_CRON_SECRET: get('STORIES_CRON_SECRET'),
  }),
);
