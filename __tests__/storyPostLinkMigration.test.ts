declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

const { readFileSync } = require('fs');
const sql = readFileSync(`${__dirname}/../supabase/migrations/0032_story_post_link.sql`, 'utf8');

describe('0032_story_post_link.sql', () => {
  it('story ligado ao post; post apagado só tira o link (o story continua)', () => {
    expect(sql).toMatch(
      /alter table public\.stories\s+add column if not exists post_id uuid references public\.posts \(id\) on delete set null/,
    );
  });
});
