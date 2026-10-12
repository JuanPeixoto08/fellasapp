// Postgres de verdade (PGlite) com o mínimo do Supabase que as migrações dos jogos usam.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SKELETON } from './skeleton';

export const MIGRATIONS: string[] = [
  '0027_fellas_games.sql',
  '0028_blackjack.sql',
  '0029_fellas_games_ajustes.sql',
  '0030_poker.sql',
  '0031_poker_safeupdate.sql',
  '0033_fellas_inc_catalogo.sql',
  '0034_fellas_inc.sql',
  '0035_fellas_inc_placar_taxa.sql',
  '0036_fellas_inc_sem_reset.sql',
  '0037_fellas_inc_catalogo_gente.sql',
  '0038_fellas_inc_gente.sql',
  '0040_fellas_inc_catalogo_conquistas.sql',
  '0041_fellas_inc_prestigio.sql',
  '0043_fellas_inc_bolsa.sql',
  '0044_fellas_inc_venda_oportunidades.sql',
  '0045_fellas_inc_dourados.sql',
  '0046_fellas_inc_contratos_na_venda.sql',
  '0047_fellas_inc_catalogo_horta.sql',
  '0048_fellas_inc_horta.sql',
  '0049_fellas_inc_oportunidades_sorte.sql',
  '0050_fellas_inc_catalogo_convidados.sql',
  '0051_fellas_inc_convidados.sql',
  '0052_fellas_inc_toby_fox.sql',
  '0053_fellas_inc_catalogo_conquistas.sql',
  '0054_fellas_inc_catalogo_fez_o_l.sql',
  '0055_fellas_inc_fez_o_l.sql',
  '0056_fellas_inc_catalogo_mapa.sql',
];

export type TestDb = Awaited<ReturnType<typeof freshDb>>;

/** A próxima quarta às 15h de Brasília (18h UTC), pelo menos 1 dia à frente. Os testes de oportunidade param o relógio
 *  nela (o now() do PGlite segue o Date falso do vitest): perto da virada da semana (segunda 0h) ou do dia ainda não tem
 *  oportunidades guardadas, e o teste falhava conforme a hora em que rodava. */
export function quartaATarde(agora = Date.now()): Date {
  const d = new Date(agora + 86_400_000);
  d.setUTCHours(18, 0, 0, 0);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** `conquistas: false` esvazia o catálogo das conquistas: os testes das entregas 1 e 2 conferem a conta exata, sem o
 *  +1% de cada conquista que as ações vão ganhando. */
export async function freshDb(opcoes: { conquistas?: boolean } = {}) {
  const db = new PGlite();
  await db.exec(SKELETON);
  for (const name of MIGRATIONS) {
    await db.exec(readFileSync(resolve(__dirname, '../../supabase/migrations', name), 'utf8'));
  }
  if (opcoes.conquistas === false) await db.exec('delete from public.idle_cat_conquista where true');
  const t = {
    db,
    async as(uid: string | null) {
      await db.query(`select set_config('test.uid', $1, false)`, [uid ?? '']);
    },
    async member(uid: string, opts: { username?: string; isMember?: boolean } = {}) {
      await db.query(
        `insert into public.profiles (id, username, display_name, is_member) values ($1, $2, $2, $3)`,
        [uid, opts.username ?? uid.slice(-4), opts.isMember ?? true],
      );
    },
    /** Chama a função como `authenticated` (o papel do app), devolvendo o jsonb/escalar. */
    async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
      const names = Object.keys(args);
      const call = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as v`;
      const rows = await t.asRole<{ v: T }>('authenticated', call, Object.values(args));
      return rows[0].v;
    },
    async asRole<T>(role: 'authenticated' | 'anon', sql: string, params: unknown[] = []): Promise<T[]> {
      await db.exec(`set role ${role}`);
      try {
        return (await db.query<T>(sql, params)).rows;
      } finally {
        await db.exec('reset role');
      }
    },
  };
  return t;
}
