declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

const { readFileSync } = require('fs');
const poker = readFileSync(`${__dirname}/../supabase/migrations/0030_poker.sql`, 'utf8');

// O comportamento roda de verdade em games/test (PGlite); aqui ficam as travas que não podem sumir.
describe('0030_poker.sql', () => {
  it('baralho e cartas de cada um: ninguém lê', () => {
    expect(poker).toContain('alter table public.poker_secrets enable row level security;');
    expect(poker).not.toMatch(/create policy[^;]*poker_secrets/);
    expect(poker).not.toMatch(/create policy[^;]*poker_leaves/);
  });

  it('o app só lê a mesa e joga pelas funções', () => {
    expect(poker).toContain('grant select on public.poker_tables, public.poker_seats, public.poker_hands to authenticated;');
    expect(poker).toContain('grant execute on function public.poker_act(uuid, int, text, int) to authenticated;');
    expect(poker).toContain('revoke all on function public.poker_finish(uuid) from public, anon, authenticated;');
    expect(poker).toContain('revoke all on function public.poker_maybe_start() from public, anon, authenticated;');
  });

  it('retrato da mesa no tempo real e relógio pelo cron a cada minuto', () => {
    expect(poker).toContain('alter publication supabase_realtime add table public.poker_tables;');
    expect(poker).toContain("cron.schedule('fellas-poker-tick', '* * * * *'");
  });

  it('reset trava mesa e carteiras antes de mexer (M2)', () => {
    expect(poker).toContain('perform 1 from public.game_wallets where week_start < v_new for update;');
  });

  it('Blackjack trava a carteira antes da mão, na mesma ordem do reset (sem deadlock à meia-noite)', () => {
    expect(poker).toMatch(
      /create or replace function public\.bj_act[\s\S]*?from public\.game_wallets where user_id = auth\.uid\(\) for update;[\s\S]*?from public\.bj_rounds where id = p_round/,
    );
  });
});
