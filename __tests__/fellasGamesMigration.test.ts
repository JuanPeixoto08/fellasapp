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
