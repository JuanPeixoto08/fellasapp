// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { comoContexto, ContextoFalso, type ParamFalso } from './falso';
import { criarAudio } from './index';

afterEach(() => vi.useRealTimers());

function montar() {
  const c = new ContextoFalso();
  const doc = document.implementation.createHTMLDocument('x');
  Object.defineProperty(doc, 'hidden', { value: false, configurable: true }); // o documento solto do happy-dom nasce escondido
  const audio = criarAudio(() => comoContexto(c), doc);
  const tocar = () => doc.dispatchEvent(new Event('pointerdown'));
  return { c, audio, tocar };
}

describe('som da Fellas Inc.', () => {
  it('antes do primeiro toque: efeito não toca e nada quebra', () => {
    const { c, audio } = montar();
    audio.tocar('compra');
    expect(c.criados).toHaveLength(0);
  });
  it('depois do toque: efeito toca; efeitos desligados não', () => {
    const { c, audio, tocar } = montar();
    audio.chaves({ musica: 0, efeitos: true });
    tocar();
    const antes = c.osciladores().length;
    audio.tocar('compra');
    expect(c.osciladores().length).toBeGreaterThan(antes);
    audio.chaves({ musica: 0, efeitos: false });
    const depois = c.osciladores().length;
    audio.tocar('pegar');
    expect(c.osciladores().length).toBe(depois);
  });
  it('clicar rápido não empilha o mesmo efeito', () => {
    const { c, audio, tocar } = montar();
    audio.chaves({ musica: 0, efeitos: true });
    tocar();
    audio.tocar('clique');
    const um = c.osciladores().length;
    audio.tocar('clique');
    expect(c.osciladores().length).toBe(um);
  });
  it('música ligada agenda notas depois do toque; desligada não agenda nada', () => {
    vi.useFakeTimers();
    const a = montar();
    a.audio.era(1);
    a.tocar();
    vi.advanceTimersByTime(100);
    expect(a.c.osciladores().length).toBeGreaterThan(0);
    const b = montar();
    b.audio.chaves({ musica: 0, efeitos: true });
    b.tocar();
    vi.advanceTimersByTime(100);
    expect(b.c.osciladores()).toHaveLength(0);
  });
  it('o sistema suspendeu o áudio (ligação, tela travada): o próximo toque retoma', () => {
    const { c, tocar } = montar();
    tocar();
    expect(c.resumidos).toBe(1);
    tocar(); // já tocando: não faz nada
    expect(c.resumidos).toBe(1);
    c.state = 'suspended';
    tocar();
    expect(c.resumidos).toBe(2);
    expect(c.state).toBe('running');
  });
  it('no celular o gesto que libera o áudio é o fim do toque (pointerup/touchend/click), não só o pointerdown', () => {
    for (const tipo of ['pointerup', 'touchend', 'click']) {
      const c = new ContextoFalso();
      const doc = document.implementation.createHTMLDocument('x');
      Object.defineProperty(doc, 'hidden', { value: false, configurable: true });
      criarAudio(() => comoContexto(c), doc);
      doc.dispatchEvent(new Event(tipo));
      expect(c.state, tipo).toBe('running');
    }
  });
  it('PC: aba escondida não desliga a música (agenda o giro à frente); celular: suspende como antes', () => {
    for (const pc of [true, false]) {
      const c = new ContextoFalso();
      const doc = document.implementation.createHTMLDocument('x');
      let escondida = false;
      Object.defineProperty(doc, 'hidden', { get: () => escondida, configurable: true });
      criarAudio(() => comoContexto(c), doc, { segundoPlano: pc });
      doc.dispatchEvent(new Event('pointerup'));
      const antes = c.osciladores().length;
      escondida = true;
      doc.dispatchEvent(new Event('visibilitychange'));
      if (pc) {
        expect(c.state).toBe('running');
        expect(c.osciladores().length).toBeGreaterThan(antes + 100); // agendou o giro
      }
      else expect(c.osciladores().length).toBe(antes);
    }
  });
  it('momento grande abaixa a música', () => {
    const { c, audio, tocar } = montar();
    tocar();
    audio.tocar('conquista');
    const musica = c.ganhos().find((g) => (g.gain as ParamFalso).eventos.some((e) => e[0] === 'alvo' && e[1] < 0.32 && e[1] > 0))!;
    expect(musica).toBeDefined();
  });
});
