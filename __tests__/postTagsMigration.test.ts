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

describe('0017_tag_list.sql', () => {
  const list = readFileSync(`${__dirname}/../supabase/migrations/0017_tag_list.sql`, 'utf8');

  it('a lista de tags pode pedir até 200 (sugestões continuam pedindo 5)', () => {
    expect(list).toMatch(/create or replace function public\.tag_suggestions/);
    expect(list).toMatch(/least\(greatest\(coalesce\(p_limit, 5\), 1\), 200\)/);
  });
});
