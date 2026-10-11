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
