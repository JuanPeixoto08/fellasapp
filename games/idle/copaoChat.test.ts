import { describe, expect, it } from 'vitest';
import { DJS, type CopaoNaNoite, type UltimaNoite } from './copao';
import { chatDaNoite, GALERA } from './copaoChat';

const copao = (x: Partial<CopaoNaNoite> = {}): CopaoNaNoite => ({
  id: 7, nome: 'Copão do Grau', base: 2, mistura: 1, extra: 1, tamanho: 2, forca: 4, preco: 20, nota: 640, vendidos: 30, fichas: 300, pt: false, ...x,
});
const noite = (x: Partial<UltimaNoite> = {}): UltimaNoite => ({
  inicio: '2026-10-12T21:00:00Z', fim: '2026-10-13T05:00:00Z', sexta: false, dj: null, vendas: 30, fichas: 300, pt: false, galera_delta: 2,
  chat_seed: 280, copoes: [copao()], ...x,
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
});
