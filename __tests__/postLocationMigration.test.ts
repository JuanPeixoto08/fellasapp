// o tsconfig não carrega os tipos do Node (só jest): declara o pouco que o teste usa
declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

import { ACCENTS_FROM, ACCENTS_TO, PLACE_MAX } from '../lib/places';

const { readFileSync } = require('fs');
const sql = readFileSync(`${__dirname}/../supabase/migrations/0020_post_location.sql`, 'utf8');

describe('0020_post_location.sql', () => {
  it('a chave é recalculada em qualquer insert/update (ninguém grava place_key na mão)', () => {
    expect(sql).toMatch(/before insert or update on public\.posts/);
    expect(sql).not.toMatch(/update of location/);
  });

  it('tabela de acentos igual à do app', () => {
    expect(sql).toContain(`translate(lower(public.clean_place(p)), '${ACCENTS_FROM}', '${ACCENTS_TO}')`);
  });

  it('mesmo limite de tamanho do app', () => {
    expect(sql).toContain(`char_length(location) between 1 and ${PLACE_MAX}`);
  });

  it('sugestões: % e _ digitados não viram curinga; só membros chamam', () => {
    expect(sql).toMatch(/replace\(replace\(replace\(/);
    expect(sql).toMatch(/'%', '\\%'\), '_', '\\_'\)/);
    expect(sql).toMatch(/security invoker/);
    expect(sql).toMatch(/grant execute on function public\.place_suggestions\(text, integer\) to authenticated/);
  });
});
