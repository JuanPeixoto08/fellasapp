import { describe, expect, it } from 'vitest';

import { freshDb } from './db';

describe('banco de teste', () => {
  it('auth.uid() segue o usuário escolhido e is_member() lê o perfil', async () => {
    const t = await freshDb();
    await t.member('00000000-0000-0000-0000-000000000001');
    await t.as('00000000-0000-0000-0000-000000000001');
    const [{ ok }] = (await t.db.query<{ ok: boolean }>('select public.is_member() as ok')).rows;
    expect(ok).toBe(true);
    await t.as(null);
    expect((await t.db.query<{ ok: boolean }>('select public.is_member() as ok')).rows[0].ok).toBe(false);
  });

  it('troca de papel funciona (RLS testável)', async () => {
    const t = await freshDb();
    const rows = await t.asRole<{ r: string }>('authenticated', 'select current_user::text as r');
    expect(rows[0].r).toBe('authenticated');
  });
});
