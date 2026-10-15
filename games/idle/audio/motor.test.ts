import { afterEach, describe, expect, it, vi } from 'vitest';

import { comoContexto, ContextoFalso, type ParamFalso } from './falso';
import { criarMotor, VOL_MUSICA } from './motor';

const volume = (m: ReturnType<typeof criarMotor>) => (m.saida()!.musica.gain as unknown as ParamFalso);

afterEach(() => vi.useRealTimers());

describe('motor', () => {
  it('nada antes do primeiro toque; ligar cria o contexto uma vez e retoma', () => {
    let criados = 0;
    const c = new ContextoFalso();
    const m = criarMotor(() => {
      criados++;
      return comoContexto(c);
    });
    expect(m.ligado()).toBe(false);
    expect(m.ctx()).toBeNull();
    m.ligar();
    m.ligar();
    expect(criados).toBe(1);
    expect(c.state).toBe('running');
    expect(volume(m).value).toBe(VOL_MUSICA); // entrou com fade
  });
  it('aba escondida: a música apaga e o contexto suspende; voltou, retoma e a música volta', () => {
    vi.useFakeTimers();
    const c = new ContextoFalso();
    const m = criarMotor(() => comoContexto(c));
    m.ligar();
    m.visivel(false);
    expect(volume(m).value).toBe(0);
    vi.advanceTimersByTime(400);
    expect(c.state).toBe('suspended');
    m.visivel(true);
    expect(c.state).toBe('running');
    expect(volume(m).value).toBe(VOL_MUSICA);
  });
  it('em segundo plano (PC): esconder a aba não apaga a música nem suspende', () => {
    vi.useFakeTimers();
    const c = new ContextoFalso();
    const m = criarMotor(() => comoContexto(c), { segundoPlano: true });
    m.ligar();
    m.visivel(false);
    vi.advanceTimersByTime(400);
    expect(c.state).toBe('running');
    expect(volume(m).value).toBe(VOL_MUSICA);
  });
  it('voltou antes do suspend: não suspende', () => {
    vi.useFakeTimers();
    const c = new ContextoFalso();
    const m = criarMotor(() => comoContexto(c));
    m.ligar();
    m.visivel(false);
    m.visivel(true);
    vi.advanceTimersByTime(400);
    expect(c.state).toBe('running');
  });
  it('volume da música: metade é metade; zero desliga e abaixar não mexe nela', () => {
    const c = new ContextoFalso();
    const m = criarMotor(() => comoContexto(c));
    m.ligar();
    m.musica(0.5);
    expect(volume(m).value).toBeCloseTo(VOL_MUSICA * 0.5);
    m.musica(0);
    expect(volume(m).value).toBe(0);
    m.abaixarMusica(2);
    expect(volume(m).value).toBe(0);
  });
  it('momento grande: a música abaixa (~−8 dB) e volta depois de `segundos`', () => {
    const c = new ContextoFalso();
    const m = criarMotor(() => comoContexto(c));
    m.ligar();
    c.currentTime = 10;
    m.abaixarMusica(2);
    const alvos = volume(m).eventos.filter((e) => e[0] === 'alvo');
    expect(alvos.at(-2)).toEqual(['alvo', VOL_MUSICA * 0.4, 10]);
    expect(alvos.at(-1)).toEqual(['alvo', VOL_MUSICA, 12]);
  });
});

describe('motor: o sistema mexeu no áudio', () => {
  it('suspendeu sozinho (fone Bluetooth, PC dormiu) com a aba à vista: retoma; interrompido também', () => {
    const c = new ContextoFalso();
    const m = criarMotor(() => comoContexto(c));
    m.ligar();
    c.mudar('suspended');
    expect(c.state).toBe('running');
    c.mudar('interrupted');
    expect(c.state).toBe('running');
    expect(c.resumidos).toBe(3);
  });
  it('celular com a aba escondida: o próprio motor suspendeu, não retoma', () => {
    vi.useFakeTimers();
    const c = new ContextoFalso();
    const m = criarMotor(() => comoContexto(c));
    m.ligar();
    m.visivel(false);
    vi.advanceTimersByTime(400);
    expect(c.state).toBe('suspended');
    expect(c.resumidos).toBe(1);
    m.visivel(true);
    expect(c.state).toBe('running');
    c.mudar('suspended'); // e depois de voltar, uma suspensão do sistema volta a ser retomada
    expect(c.state).toBe('running');
  });
  it('navegador recusou o resume: fica suspenso, sem erro solto', async () => {
    const c = new ContextoFalso();
    c.recusar = true;
    const m = criarMotor(() => comoContexto(c));
    m.ligar();
    c.state = 'running';
    c.mudar('suspended');
    await Promise.resolve();
    expect(c.state).toBe('suspended');
    expect(m.ligado()).toBe(true);
  });
  it('contexto fechado: conferir larga ele e o próximo ligar cria outro', () => {
    const cs: ContextoFalso[] = [];
    const m = criarMotor(() => comoContexto(cs[cs.push(new ContextoFalso()) - 1]));
    m.ligar();
    expect(m.conferir(0)).toBe(false);
    cs[0].mudar('closed');
    expect(m.conferir(10)).toBe(true);
    expect(m.ligado()).toBe(false);
    m.ligar();
    expect(cs).toHaveLength(2);
    expect(m.ctx()).toBe(cs[1]);
    expect(cs[1].state).toBe('running');
    expect(cs[0].fechados).toBe(0); // já estava fechado: não fecha de novo
  });
  it('rodando com o relógio parado por mais de 2 s: travou, fecha e larga; andando normal não', () => {
    const c = new ContextoFalso();
    const m = criarMotor(() => comoContexto(c));
    m.ligar();
    c.currentTime = 5;
    expect(m.conferir(0)).toBe(false);
    c.currentTime = 6;
    expect(m.conferir(3000)).toBe(false); // andou
    expect(m.conferir(4500)).toBe(false); // parado há 1,5 s: ainda não
    expect(m.conferir(5100)).toBe(true); // parado há 2,1 s
    expect(c.fechados).toBe(1);
    expect(m.ligado()).toBe(false);
  });
  it('suspenso não conta como travado (o relógio para mesmo), nem logo depois de retomar', () => {
    const c = new ContextoFalso();
    c.recusar = true;
    const m = criarMotor(() => comoContexto(c));
    m.ligar();
    expect(m.conferir(0)).toBe(false);
    expect(m.conferir(60_000)).toBe(false);
    c.recusar = false;
    c.mudar('running');
    expect(m.conferir(60_001)).toBe(false);
    expect(m.conferir(61_000)).toBe(false);
  });
  it('o contexto velho mudando de estado depois de largado não mexe em nada', () => {
    const cs: ContextoFalso[] = [];
    const m = criarMotor(() => comoContexto(cs[cs.push(new ContextoFalso()) - 1]));
    m.ligar();
    m.conferir(0);
    m.conferir(3000); // travou: fecha o velho
    m.ligar();
    const r = cs[0].resumidos;
    cs[0].state = 'running';
    cs[0].mudar('suspended');
    expect(cs[0].resumidos).toBe(r);
  });
});
