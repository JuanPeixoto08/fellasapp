// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { comoContexto, ContextoFalso, GanhoFalso, OscFalso, type ParamFalso } from './falso';
import { criarAudio } from './index';

afterEach(() => vi.useRealTimers());

function montar(o: { recusar?: boolean; segundoPlano?: boolean; escondida?: boolean } = {}) {
  const cs: ContextoFalso[] = [];
  const fabrica = () => {
    const novo = new ContextoFalso();
    novo.recusar = o.recusar ?? false;
    cs.push(novo);
    return comoContexto(novo);
  };
  const doc = document.implementation.createHTMLDocument('x');
  const janela = new EventTarget();
  const vista = { escondida: o.escondida ?? false };
  Object.defineProperty(doc, 'hidden', { get: () => vista.escondida, configurable: true }); // o documento solto do happy-dom nasce escondido
  let ms = 0;
  const audio = criarAudio(fabrica, doc, { segundoPlano: o.segundoPlano, janela, agora: () => ms });
  const tocar = () => doc.dispatchEvent(new Event('pointerdown'));
  const relogio = (novo: number) => { ms = novo; };
  return { get c() { return cs[0]; }, cs, audio, tocar, doc, janela, vista, relogio };
}

describe('som da Fellas Inc.', () => {
  // antes só ligava no 1º toque; agora tenta na criação e o caso "navegador não deixou" é o resume recusado
  it('o navegador não deixou ligar sem gesto: efeito não toca, nada quebra, e o 1º toque liga', async () => {
    const { c, audio, tocar } = montar({ recusar: true });
    expect(c.resumidos).toBe(1);
    audio.tocar('compra');
    await Promise.resolve();
    expect(c.osciladores()).toHaveLength(0);
    c.recusar = false;
    tocar();
    expect(c.state).toBe('running');
    audio.tocar('compra');
    expect(c.osciladores().length).toBeGreaterThan(0);
  });
  it('criar o áudio já tenta ligar, sem esperar o toque (aba restaurada pelo navegador)', () => {
    const { cs, audio } = montar();
    expect(cs).toHaveLength(1);
    expect(cs[0].resumidos).toBe(1);
    expect(cs[0].state).toBe('running');
    audio.chaves({ musica: 0, efeitos: true });
    audio.tocarEm('dourado', 5); // o dourado que chega com a aba no fundo soa
    expect(cs[0].osciladores().length).toBeGreaterThan(0);
  });
  it('celular com a aba escondida na criação: não liga; liga quando a aba aparece', () => {
    const { cs, doc, vista } = montar({ segundoPlano: false, escondida: true });
    expect(cs).toHaveLength(0);
    vista.escondida = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(cs).toHaveLength(1);
    expect(cs[0].state).toBe('running');
  });
  it('aba voltou, janela ganhou foco ou página voltou do cache, com o contexto suspenso: tenta retomar', () => {
    for (const [alvo, ev] of [['doc', 'visibilitychange'], ['janela', 'focus'], ['janela', 'pageshow']] as const) {
      const m = montar();
      m.c.state = 'suspended'; // sem aviso: ninguém retomou ainda
      const r = m.c.resumidos;
      (alvo === 'doc' ? m.doc : m.janela).dispatchEvent(new Event(ev));
      expect(m.c.resumidos, ev).toBeGreaterThan(r);
      expect(m.c.state, ev).toBe('running');
    }
  });
  it('não toca a música da era 0 antes do jogo dizer qual é: a música só começa com a era', () => {
    const { c, audio } = montar();
    expect(c.osciladores()).toHaveLength(0);
    audio.era(5);
    expect(c.osciladores().length).toBeGreaterThan(0);
  });
  it('música começando com o contexto suspenso não despeja notas quando ele liga', () => {
    vi.useFakeTimers();
    const { c, audio, tocar } = montar({ recusar: true });
    audio.era(1);
    const n = c.osciladores().length;
    vi.advanceTimersByTime(10_000); // relógio do áudio parado (suspenso): nada novo
    expect(c.osciladores().length).toBe(n);
    c.recusar = false;
    tocar();
    vi.advanceTimersByTime(100);
    expect(c.osciladores().length).toBe(n);
  });
  it('contexto fechado: o próximo efeito cria outro e toca nele; a música recomeça no novo', () => {
    vi.useFakeTimers();
    const { cs, audio } = montar();
    audio.era(1);
    audio.tocarEm('dourado', 30);
    cs[0].mudar('closed');
    const velho = cs[0].criados.length;
    audio.tocar('compra');
    expect(cs).toHaveLength(2);
    expect(cs[0].criados).toHaveLength(velho);
    expect(cs[1].state).toBe('running');
    const notas = cs[1].osciladores().length;
    expect(notas).toBeGreaterThan(0);
    cs[1].currentTime = 2;
    vi.advanceTimersByTime(50);
    expect(cs[1].osciladores().length).toBeGreaterThan(notas); // o sequenciador segue no relógio do novo
    // o canal dos agendados era do velho: o novo agendado tem canal próprio, ligado no novo
    const idx = cs[1].criados.length;
    audio.tocarEm('dourado', 30);
    const canal = cs[1].criados.slice(idx).find((n) => n instanceof GanhoFalso)!;
    expect(cs[1].criados).toContain(canal.ligados[0]);
  });
  it('contexto fechado: o toque também recria', () => {
    const { cs, tocar } = montar();
    cs[0].mudar('closed');
    tocar();
    expect(cs).toHaveLength(2);
    expect(cs[1].state).toBe('running');
  });
  it('rodando com o relógio parado por mais de 2 s: recria; andando normal não', () => {
    const { cs, audio, relogio } = montar();
    audio.chaves({ musica: 0, efeitos: true });
    audio.tocar('compra');
    relogio(2500);
    cs[0].currentTime = 2.5;
    audio.tocar('pegar');
    expect(cs).toHaveLength(1);
    relogio(5100);
    audio.tocar('clique');
    expect(cs).toHaveLength(2);
    expect(cs[0].fechados).toBe(1);
    expect(cs[1].osciladores().length).toBeGreaterThan(0); // o efeito saiu no novo
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
      const { c, doc } = montar({ recusar: true }); // agora já tenta na criação: sem gesto o navegador recusa
      c.recusar = false;
      doc.dispatchEvent(new Event(tipo));
      expect(c.state, tipo).toBe('running');
    }
  });
  it('PC: aba escondida não desliga a música (agenda o giro à frente); celular: suspende como antes', () => {
    for (const pc of [true, false]) {
      const { c, doc, vista, audio } = montar({ segundoPlano: pc });
      audio.era(1); // a música só começa com a era
      doc.dispatchEvent(new Event('pointerup'));
      const antes = c.osciladores().length;
      vista.escondida = true;
      doc.dispatchEvent(new Event('visibilitychange'));
      if (pc) {
        expect(c.state).toBe('running');
        expect(c.osciladores().length).toBeGreaterThan(antes + 100); // agendou o giro
      }
      else expect(c.osciladores().length).toBe(antes);
    }
  });
  it('som agendado pra daqui a pouco (aba escondida): toca no relógio do áudio; voltar cancela os que faltam', () => {
    const { c, audio, tocar } = montar();
    audio.chaves({ musica: 0, efeitos: true });
    tocar();
    c.currentTime = 100;
    const idx = c.criados.length;
    audio.tocarEm('dourado', 30);
    const novos = c.criados.slice(idx);
    const oscs = novos.filter((n): n is OscFalso => n instanceof OscFalso);
    expect(oscs.length).toBeGreaterThan(0);
    expect(Math.min(...oscs.map((o) => o.inicio!))).toBeCloseTo(130, 3);
    const canal = novos.find((n) => n instanceof GanhoFalso)!; // o canal dos agendados vem primeiro
    expect(canal.ligados.length).toBe(1);
    audio.cancelarAgendados();
    expect(canal.ligados).toHaveLength(0); // desligado: o que faltava não soa
  });
  it('efeitos desligados: nada agendado', () => {
    const { c, audio, tocar } = montar();
    audio.chaves({ musica: 0, efeitos: false });
    tocar();
    const antes = c.osciladores().length;
    audio.tocarEm('dourado', 10);
    expect(c.osciladores().length).toBe(antes);
  });
  it('momento grande abaixa a música', () => {
    const { c, audio, tocar } = montar();
    tocar();
    audio.tocar('conquista');
    const musica = c.ganhos().find((g) => (g.gain as ParamFalso).eventos.some((e) => e[0] === 'alvo' && e[1] < 0.32 && e[1] > 0))!;
    expect(musica).toBeDefined();
  });
});
