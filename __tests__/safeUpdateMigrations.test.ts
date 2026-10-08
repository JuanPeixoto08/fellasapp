declare const require: (id: string) => {
  readFileSync: (path: string, encoding: string) => string;
  readdirSync: (path: string) => string[];
};
declare const __dirname: string;

const { readFileSync, readdirSync } = require('fs');
const dir = `${__dirname}/../supabase/migrations`;

// O Supabase liga o pg_safeupdate nas chamadas que vêm do app (PostgREST): DELETE/UPDATE sem WHERE dá erro, mesmo
// dentro de função. O PGlite dos testes não tem isso, então a trava é aqui. (0030 tinha três; a 0031 troca as funções.)
const LEGACY = new Set(['0030_poker.sql']);

describe('migrações sem DELETE/UPDATE sem WHERE', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql') && f >= '0030' && !LEGACY.has(f));

  it('a 0031 existe e entra na checagem', () => {
    expect(files).toContain('0031_poker_safeupdate.sql');
  });

  for (const f of files) {
    it(f, () => {
      const sql = readFileSync(`${dir}/${f}`, 'utf8')
        .split('\n')
        .map((l) => l.replace(/--.*$/, ''))
        .join('\n');
      for (const stmt of sql.split(';')) {
        const flat = stmt.replace(/\s+/g, ' ').toLowerCase();
        const at = flat.search(/(delete from|update) public\./);
        if (at < 0) continue;
        const s = flat.slice(at);
        if (!s.includes(' where ')) throw new Error(`sem WHERE em ${f}: ${s.trim()}`);
      }
    });
  }
});
