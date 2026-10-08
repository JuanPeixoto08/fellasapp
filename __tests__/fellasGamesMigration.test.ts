declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

const { readFileSync } = require('fs');
const credits = readFileSync(`${__dirname}/../supabase/migrations/0027_fellas_games.sql`, 'utf8');

// O comportamento roda de verdade em games/test (PGlite); aqui ficam as travas que não podem sumir.
describe('0027_fellas_games.sql', () => {
  it('saldo nunca negativo e tabelas fechadas para o app', () => {
    expect(credits).toContain('balance        int not null check (balance >= 0)');
    expect(credits).toContain(
      'revoke all on public.game_wallets, public.game_ledger, public.game_weeks from anon, authenticated;',
    );
  });

  it('reset só pelo cron, segunda 03:00 UTC (00:00 em Brasília)', () => {
    expect(credits).toContain('revoke all on function public.games_weekly_reset() from public, anon, authenticated;');
    expect(credits).toContain("cron.schedule('fellas-games-reset', '0 3 * * 1'");
  });
});

const ajustes = readFileSync(`${__dirname}/../supabase/migrations/0029_fellas_games_ajustes.sql`, 'utf8');

describe('0029_fellas_games_ajustes.sql', () => {
  it('aposta múltipla de 10, sapato apagado no fim, funções de conta fechadas', () => {
    expect(ajustes).toContain('p_bet % 10 <> 0');
    expect(ajustes).toContain('delete from public.bj_secrets where round_id = r.id;');
    expect(ajustes).toContain('revoke all on function public.bj_hand_total(smallint[]) from public, anon, authenticated;');
  });
});

const blackjack = readFileSync(`${__dirname}/../supabase/migrations/0028_blackjack.sql`, 'utf8');

describe('0028_blackjack.sql', () => {
  it('o sapato (bj_secrets) não tem política nenhuma: ninguém lê', () => {
    expect(blackjack).toContain('alter table public.bj_secrets enable row level security;');
    expect(blackjack).not.toMatch(/create policy[^;]*bj_secrets/);
  });

  it('o app só joga pelas funções', () => {
    expect(blackjack).toContain('grant execute on function public.bj_deal(int) to authenticated;');
    expect(blackjack).toContain('grant execute on function public.bj_act(uuid, text) to authenticated;');
    expect(blackjack).toContain('revoke all on function public.bj_finish(uuid) from public, anon, authenticated;');
  });
});
