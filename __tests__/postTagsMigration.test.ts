// o tsconfig não carrega os tipos do Node (só jest): declara o pouco que o teste usa
declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

const { readFileSync } = require('fs');
const sql = readFileSync(`${__dirname}/../supabase/migrations/0016_post_tags.sql`, 'utf8');

describe('0016_post_tags.sql', () => {
  it('as tags são recalculadas em qualquer update (ninguém grava posts.tags na mão)', () => {
    expect(sql).toMatch(/before insert or update on public\.posts/);
    expect(sql).not.toMatch(/update of body/);
  });
});
