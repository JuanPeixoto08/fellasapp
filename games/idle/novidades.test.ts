// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import { dataNovidade, NOVIDADES, temNovidade } from './novidades';
import { lerSom, lerVista, marcarVista, gravarSom } from './preferencias';

describe('patch notes', () => {
  it('da mais nova pra mais antiga, ids únicos, toda versão com título e pelo menos uma linha', () => {
    const datas = NOVIDADES.map((n) => n.data);
    expect([...datas].sort().reverse()).toEqual(datas);
    expect(new Set(NOVIDADES.map((n) => n.id)).size).toBe(NOVIDADES.length);
    for (const n of NOVIDADES) {
      expect(n.titulo.length).toBeGreaterThan(0);
      expect(n.itens.length).toBeGreaterThan(0);
    }
  });
  it('bolinha: quem nunca leu ou leu uma antiga vê; quem leu a mais nova não vê', () => {
    expect(temNovidade(null)).toBe(true);
    expect(temNovidade(NOVIDADES[NOVIDADES.length - 1].id)).toBe(true);
    expect(temNovidade(NOVIDADES[0].id)).toBe(false);
  });
  it('a nota da Bolsa explica a ligação com os geradores', () => {
    const bolsa = NOVIDADES.find((n) => n.id === '2026-10-11-bolsa')!;
    expect(bolsa.itens).toContain('Cada empresa da Bolsa é ligada a um gerador: quanto mais dele, mais ações você pode ter.');
  });
  it('data em pt-BR curta', () => {
    expect(dataNovidade('2026-10-11')).toBe('11/10/2026');
  });
});

describe('preferências no aparelho', () => {
  beforeEach(() => localStorage.clear());
  it('som começa ligado e lembra o desligado', () => {
    expect(lerSom()).toBe(true);
    gravarSom(false);
    expect(lerSom()).toBe(false);
    gravarSom(true);
    expect(lerSom()).toBe(true);
  });
  it('a versão lida fica guardada', () => {
    expect(lerVista()).toBeNull();
    marcarVista();
    expect(lerVista()).toBe(NOVIDADES[0].id);
    expect(temNovidade(lerVista())).toBe(false);
  });
});
