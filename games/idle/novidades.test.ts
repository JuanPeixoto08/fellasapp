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
  it('a mais nova é a do cupom e da meia-preço no 10 e no Máx; depois, as de antes na mesma ordem', () => {
    expect(NOVIDADES[0]).toMatchObject({ id: '2026-10-16-cupom-meia-max', titulo: 'Cupom e meia-preço no 10 e no Máx', data: '2026-10-16' });
    expect(NOVIDADES[1]).toMatchObject({ id: '2026-10-15-eras-6-7', titulo: 'Eras 6 e 7: órbita e Lua' });
    expect(NOVIDADES[2]).toMatchObject({ id: '2026-10-15-som-volta', titulo: 'O som não some mais' });
    expect(NOVIDADES[3]).toMatchObject({ id: '2026-10-15-dourados-caixinha', titulo: 'Dourados novos e uma Caixinha mais cheia' });
    expect(NOVIDADES[4]).toMatchObject({ id: '2026-10-15-placar-na-cena', titulo: 'Placar em cima da cena' });
    expect(NOVIDADES[5]).toMatchObject({ id: '2026-10-15-menos-roxo', titulo: 'Roxo só no que é pra apertar' });
    expect(NOVIDADES[6]).toMatchObject({ id: '2026-10-15-quarto-inicio', titulo: 'O quarto das 3h06 ficou maior' });
    expect(NOVIDADES[7]).toMatchObject({ id: '2026-10-15-jogo-do-brasil-trava', titulo: 'Jogo do Brasil sem clique perdido' });
    expect(NOVIDADES[8]).toMatchObject({ id: '2026-10-14-eras-1-5', titulo: 'As eras 1 a 5 ganharam vida' });
    expect(NOVIDADES[9]).toMatchObject({ id: '2026-10-14-copao-uma-prova', titulo: 'Copão: uma prova por vez' });
    expect(NOVIDADES.slice(10, 18).map((n) => n.id)).toEqual(['2026-10-14-bolsa-melhorias','2026-10-14-mapa-ritmo', '2026-10-13-mapa-do-role', '2026-10-13-somam', '2026-10-13-dobro', '2026-10-13-empilha', '2026-10-13-arvore', '2026-10-12-conquistas']);
  });

  it('a nota do cupom e da meia-preço explica as duas regras novas e não conta escondidas', () => {
    const texto = NOVIDADES[0].itens.join(' ');
    expect(texto).toContain('por gerador');
    expect(texto).toContain('compra inteira');
    expect(texto).not.toContain('Sillas');
  });
  it('a nota das eras 6 e 7 não conta as escondidas (o monolito e a Daisy) nem o segredo', () => {
    const texto = NOVIDADES.find((n) => n.id === '2026-10-15-eras-6-7')!.itens.join(' ');
    for (const nome of ['Meu Deus', 'Daisy', 'monolito', 'Monolito', 'Sillas']) expect(texto).not.toContain(nome);
  });
  it('a nota da entrega 5 não conta as conquistas escondidas nem o segredo', () => {
    const texto = NOVIDADES.find((n) => n.id === '2026-10-15-dourados-caixinha')!.itens.join(' ');
    for (const nome of ['O tigre tá pagando', 'Insider', 'Sillas']) expect(texto).not.toContain(nome);
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
