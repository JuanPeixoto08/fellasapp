import { describe, expect, it } from 'vitest';
import { DJS, type CopaoNaNoite, type UltimaNoite } from './copao';
import { chatDaNoite, chatDaProva, GALERA } from './copaoChat';

const copao = (x: Partial<CopaoNaNoite> = {}): CopaoNaNoite => ({
  id: 7, nome: 'Copão do Grau', base: 2, mistura: 1, extra: 1, tamanho: 2, forca: 4, preco: 20, nota: 640, vendidos: 30, fichas: 300, pt: false, ...x,
});
const noite = (x: Partial<UltimaNoite> = {}): UltimaNoite => ({
  inicio: '2026-10-12T21:00:00Z', fim: '2026-10-13T05:00:00Z', sexta: false, dj: null, vendas: 30, fichas: 300, pt: false, galera_delta: 2,
  chat_seed: 280, copoes: [copao()], saiu_antes: 0, ...x,
});

describe('o chat da galera', () => {
  it('8 a 12 mensagens, sem repetir, ninguém fala duas vezes seguidas, só gente da galera inventada', () => {
    for (let seed = 0; seed < 60; seed++) {
      const msgs = chatDaNoite(noite({ chat_seed: seed, copoes: seed % 7 === 0 ? [] : [copao(), copao({ id: 8, nome: 'Balde Sem Freio', tamanho: 3, base: 1 })] }), 'u1');
      expect(msgs.length).toBeGreaterThanOrEqual(8);
      expect(msgs.length).toBeLessThanOrEqual(12);
      expect(new Set(msgs.map((m) => m.texto)).size).toBe(msgs.length);
      msgs.forEach((m, i) => {
        expect(GALERA).toContain(m.autor);
        if (i) expect(m.autor).not.toBe(msgs[i - 1].autor);
        expect(m.texto).not.toMatch(/\{\w+\}/);
        expect(m.texto.charAt(0)).toBe(m.texto.charAt(0).toUpperCase());
      });
    }
  });
  it('cardápio vazio só quando ninguém esteve nele; se os copões saíram antes da nota, a galera fala disso', () => {
    const vazio = /vazio|não tinha copão/;
    const saiu = /saiu do cardápio|sumido do cardápio|tiraram/i;
    for (let seed = 0; seed < 30; seed++) {
      const nada = chatDaNoite(noite({ chat_seed: seed, copoes: [], vendas: 0, fichas: 0 }), 'u1').map((m) => m.texto).join(' ');
      expect(nada).toMatch(vazio);
      const tirados = chatDaNoite(noite({ chat_seed: seed, copoes: [], saiu_antes: 2, vendas: 40, fichas: 300 }), 'u1').map((m) => m.texto).join(' ');
      expect(tirados).not.toMatch(vazio);
      expect(tirados).toMatch(saiu);
    }
  });
  it('a mesma noite e a mesma pessoa dão o mesmo chat; outra noite muda', () => {
    expect(chatDaNoite(noite(), 'u1')).toEqual(chatDaNoite(noite(), 'u1'));
    expect(chatDaNoite(noite({ chat_seed: 281 }), 'u1')).not.toEqual(chatDaNoite(noite(), 'u1'));
  });
  it('fala do copão pela nota e pelo nome', () => {
    const msgs = chatDaNoite(noite({ copoes: [copao({ nota: 120 })] }), 'u1');
    expect(msgs.some((m) => m.texto.includes('Copão do Grau'))).toBe(true);
  });
  it('noite com PT: aparece no chat como PT', () => {
    const msgs = chatDaNoite(noite({ pt: true, galera_delta: -10, copoes: [copao({ pt: true, forca: 9 })] }), 'u1');
    expect(msgs.filter((m) => m.tipo === 'pt').length).toBeGreaterThanOrEqual(1);
  });
  it('sexta com DJ: o DJ só "tocou" (nunca fala, nunca opina); fora da sexta o DJ não aparece', () => {
    for (const dj of DJS) for (let seed = 0; seed < 12; seed++) {
      const msgs = chatDaNoite(noite({ sexta: true, dj: dj.id, chat_seed: seed, copoes: [copao({ base: dj.bases[0] })] }), `u${seed}`);
      expect(msgs.some((m) => m.tipo === 'dj')).toBe(true);
      for (const m of msgs) {
        if (m.texto.includes(dj.nome)) expect(m.texto).toMatch(new RegExp(`^${dj.nome} tocou ${dj.estilo}`));
        expect(m.autor).not.toContain(dj.nome);
        expect(m.texto).not.toMatch(/\b(disse|falou|postou|comentou|acha|achou|gosta|odeia|curtiu)\b/i);
      }
      const semSexta = chatDaNoite(noite({ sexta: false, dj: dj.id, chat_seed: seed }), `u${seed}`);
      expect(semSexta.some((m) => m.texto.includes(dj.nome) || m.tipo === 'dj')).toBe(false);
    }
  });
  it('preço salgado e balde: a galera reclama', () => {
    const msgs = chatDaNoite(noite({ copoes: [copao({ tamanho: 3, forca: 4, preco: 125, nota: 400 })], chat_seed: 3 }), 'u1');
    expect(msgs.some((m) => /fichas/.test(m.texto) || /balde/i.test(m.texto))).toBe(true);
  });
  it('o nome do copão é texto livre: nunca vem com artigo na frente (o, a, um, do, no...)', () => {
    for (let seed = 0; seed < 80; seed++) {
      const cs = [copao({ nome: 'Bomba Zica', nota: [120, 450, 650, 850][seed % 4], forca: 1 + (seed % 10), tamanho: 1 + (seed % 3), pt: seed % 5 === 0 })];
      for (const m of chatDaNoite(noite({ chat_seed: seed, copoes: cs, pt: cs[0].pt }), 'u1')) {
        expect(m.texto).not.toMatch(/\b(o|a|um|uma|do|da|no|na|pelo|pela|segundo)\s+Bomba Zica/i);
      }
    }
  });
});

describe('o que a galera falou da prova (0069)', () => {
  it('2 ou 3 falas da galera inventada, sem placeholder, sem DJ; a mesma prova dá o mesmo; a nota muda o tom', () => {
    for (let id = 1; id <= 80; id++) {
      const p = { id, base: (id % 3) + 1, mistura: (id % 4) + 1, extra: (id % 3) + 1, tamanho: (id % 2) + 1, forca: (id % 10) + 1, preco: 10 + (id % 7), nota: (id * 97) % 1000 };
      const msgs = chatDaProva(p, 'u1');
      expect(msgs.length).toBeGreaterThanOrEqual(2);
      expect(msgs.length).toBeLessThanOrEqual(3);
      expect(chatDaProva(p, 'u1')).toEqual(msgs);
      msgs.forEach((m, i) => {
        expect(GALERA).toContain(m.autor);
        if (i) expect(m.autor).not.toBe(msgs[i - 1].autor);
        expect(m.texto).not.toMatch(/\{\w+\}/);
        for (const d of DJS) expect(m.texto).not.toContain(d.nome);
      });
    }
    const base = { id: 5, base: 2, mistura: 1, extra: 1, tamanho: 2, forca: 4, preco: 20 };
    expect(chatDaProva({ ...base, nota: 900 }, 'u1')[0].texto).not.toBe(chatDaProva({ ...base, nota: 100 }, 'u1')[0].texto);
  });
});
