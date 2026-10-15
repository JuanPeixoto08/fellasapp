// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import { dataNovidade, NOVIDADES, temNovidade } from './novidades';
import { gravarChave, gravarVolumeMusica, lerChave, lerVista, lerVolumeMusica, marcarVista } from './preferencias';

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
    expect(NOVIDADES.find((n) => n.id === '2026-10-11-bolsa')!.itens).toContain('Cada empresa da Bolsa é ligada a um gerador: quanto mais dele, mais ações você pode ter.');
  });
  it('a mais nova é a do Jogo do Brasil sem clique perdido; antes, as eras 1 a 5, o copão com uma prova por vez, as melhorias da Bolsa, o Mapa do rolê mais rápido, o Mapa do rolê, os ×5 que somam, o dobro e a Era 6, as oportunidades que empilham, a árvore e as conquistas', () => {
    expect(NOVIDADES[0]).toMatchObject({ id: '2026-10-15-jogo-do-brasil-trava', titulo: 'Jogo do Brasil sem clique perdido' });
    expect(NOVIDADES[1]).toMatchObject({ id: '2026-10-14-eras-1-5', titulo: 'As eras 1 a 5 ganharam vida' });
    expect(NOVIDADES[2]).toMatchObject({ id: '2026-10-14-copao-uma-prova', titulo: 'Copão: uma prova por vez' });
    expect(NOVIDADES.slice(3, 11).map((n) => n.id)).toEqual(['2026-10-14-bolsa-melhorias','2026-10-14-mapa-ritmo', '2026-10-13-mapa-do-role', '2026-10-13-somam', '2026-10-13-dobro', '2026-10-13-empilha', '2026-10-13-arvore', '2026-10-12-conquistas']);
  });
  it('data em pt-BR curta', () => {
    expect(dataNovidade('2026-10-11')).toBe('11/10/2026');
  });
});

describe('preferências no aparelho', () => {
  beforeEach(() => localStorage.clear());
  it('música, efeitos e avisos começam ligados e cada um lembra o desligado', () => {
    for (const q of ['efeitos', 'avisos'] as const) {
      expect(lerChave(q)).toBe(true);
      gravarChave(q, false);
      expect(lerChave(q)).toBe(false);
      gravarChave(q, true);
      expect(lerChave(q)).toBe(true);
    }
    gravarChave('efeitos', false);
    expect(lerChave('avisos')).toBe(true);
    expect(localStorage.getItem('fellas:idle-efeitos')).toBe('0');
  });
  it('volume da música: começa em 100%, lembra o escolhido; quem tinha desligado a música começa em 0', () => {
    expect(lerVolumeMusica()).toBe(1);
    gravarVolumeMusica(0.4);
    expect(lerVolumeMusica()).toBe(0.4);
    localStorage.clear();
    localStorage.setItem('fellas:idle-musica', '0');
    expect(lerVolumeMusica()).toBe(0);
    gravarVolumeMusica(2);
    expect(lerVolumeMusica()).toBe(1);
  });
  it('a versão lida fica guardada', () => {
    expect(lerVista()).toBeNull();
    marcarVista();
    expect(lerVista()).toBe(NOVIDADES[0].id);
    expect(temNovidade(lerVista())).toBe(false);
  });
});
