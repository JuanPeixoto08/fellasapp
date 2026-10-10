// Sem @types/node no app: o mesmo jeito de ler arquivo que fellasGamesMigration.test.ts e safeUpdateMigrations.test.ts.
declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

const { readFileSync } = require('fs');

// O comportamento roda de verdade em games/test (PGlite); aqui ficam as travas que não podem sumir.
const ler = (n: string) => readFileSync(`${__dirname}/../supabase/migrations/${n}`, 'utf8');
const logica = ler('0034_fellas_inc.sql');
const catalogo = ler('0033_fellas_inc_catalogo.sql');
// Sem os comentários `--`: a 0034 cita weekly_champion num comentário justamente para dizer que não mexe nele.
const logicaSemComentarios = logica.split(/\r?\n/).map((l: string) => l.replace(/--.*$/, '')).join('\n');

describe('Fellas Inc. (0033/0034)', () => {
  it('reset agendado para segunda 00:00 de Brasília', () => {
    expect(logica).toContain("cron.schedule('fellas-inc-reset', '2 3 * * 1'");
  });
  it('não toca nos créditos do cassino', () => {
    for (const proibido of ['game_wallets', 'game_ledger', 'games_move', 'weekly_champion']) expect(logicaSemComentarios).not.toContain(proibido);
  });
  it('funções internas fechadas; as do jogo só para quem está logado', () => {
    for (const f of ['idle_rate(public.idle_state)', 'idle_settle(public.idle_state, timestamptz)', 'idle_lock(uuid)', 'idle_weekly_reset()'])
      expect(logica).toContain(`revoke all on function public.${f} from public, anon, authenticated;`);
    for (const f of ['idle_open()', 'idle_start()', 'idle_buy(text, int, int)', 'idle_pick_strategy(int, int)', 'idle_claim_opportunity(bigint)', 'idle_board()'])
      expect(logica).toContain(`grant execute on function public.${f} to authenticated;`);
  });
  it('o catálogo é gerado (não editado à mão)', () => {
    expect(catalogo).toContain('GERADO por games/idle/catalogo.ts');
  });
});

describe('Fellas Inc. sem reset (0036)', () => {
  const sem = ler('0036_fellas_inc_sem_reset.sql').split(/\r?\n/).map((l: string) => l.replace(/--.*$/, '')).join('\n');
  it('só tira a foto: nada é apagado', () => {
    expect(sem).toContain('create or replace function public.idle_weekly_reset');
    expect(sem).not.toContain('delete from public.idle_state');
    for (const proibido of ['game_wallets', 'game_ledger', 'games_move', 'weekly_champion']) expect(sem).not.toContain(proibido);
  });
});

const gente = ler('0038_fellas_inc_gente.sql');
const genteSemComentarios = gente.split(/\r?\n/).map((l: string) => l.replace(/--.*$/, '')).join('\n');
const notificacao = ler('0039_notificacao_contrato.sql');
/** O `create or replace function public.notifications_feed ... $$;` de uma migração. */
const feed = (sql: string) => {
  const s = sql.replace(/\r\n/g, '\n');
  const ini = s.indexOf('create or replace function public.notifications_feed');
  return s.slice(ini, s.indexOf('$$;', ini) + 3);
};
const BLOCO_IDLE = /\n\n {4}union all\n {4}-- Fellas Inc\.: alguém me contratou[\s\S]*?c\.created_at >= me\.since\n/;

describe('Fellas Inc., entrega 2 (0038–0039)', () => {
  it('não toca nos créditos do cassino', () => {
    for (const proibido of ['game_wallets', 'game_ledger', 'games_move', 'weekly_champion']) expect(genteSemComentarios).not.toContain(proibido);
  });
  it('sem reset: nada apaga estado nem contrato', () => {
    for (const proibido of ['delete from public.idle_state', 'delete from public.idle_contracts']) expect(genteSemComentarios).not.toContain(proibido);
  });
  it('funções internas fechadas; as do jogo só para quem está logado', () => {
    for (const f of [
      'idle_avatar_json(uuid)', 'idle_json(public.idle_state)', 'idle_employee_mult(uuid)',
      'idle_social_mult(public.idle_state, timestamptz)', 'idle_rate_at(public.idle_state, timestamptz)', 'idle_rate(public.idle_state)',
      'idle_settle(public.idle_state, timestamptz)', 'idle_hire_price(public.idle_state)', 'idle_next_change(public.idle_state)',
      'idle_lock_all(uuid[])', 'idle_most_hired(date)', 'idle_weekly_reset()',
    ])
      expect(gente).toContain(`revoke all on function public.${f} from public, anon, authenticated;`);
    for (const f of ['idle_set_avatar(int, int, int, int, int, int, int)', 'idle_hire(uuid)', 'idle_pick_strategy(int, int)', 'idle_board()'])
      expect(gente).toContain(`grant execute on function public.${f} to authenticated;`);
  });
  it('tabelas novas com RLS e leitura só para membros', () => {
    for (const t of ['idle_avatar', 'idle_contracts']) {
      expect(gente).toContain(`alter table public.${t} enable row level security;`);
      expect(gente).toContain(`create policy "${t}_select_members" on public.${t} for select to authenticated using (public.is_member());`);
    }
  });
  it('o catálogo novo é o gerado', () => {
    expect(ler('0037_fellas_inc_catalogo_gente.sql')).toContain('GERADO por games/idle/catalogo.ts');
  });
  it('0039: a função de notificações é a da 0021 mais o idle_hired', () => {
    const nova = feed(notificacao);
    expect(nova).toMatch(BLOCO_IDLE);
    expect(nova.replace(BLOCO_IDLE, '\n')).toBe(feed(ler('0021_stories.sql')));
    expect(notificacao).toContain('grant execute on function public.notifications_feed(integer) to authenticated;');
  });
});
