import {
  cleanOptions,
  dayOptions,
  durationMinutes,
  hourOptions,
  minuteOptions,
  normalizeDuration,
  pollPercents,
  pollReady,
  pollTimeLeft,
  pollWinners,
  votesLabel,
} from '../lib/polls';

describe('duração da enquete', () => {
  it('7 dias zera horas e minutos (máximo)', () => {
    expect(normalizeDuration({ days: 7, hours: 5, minutes: 30 })).toEqual({ days: 7, hours: 0, minutes: 0 });
  });
  it('0 dias e 0 horas: minutos sobem para 5 (mínimo)', () => {
    expect(normalizeDuration({ days: 0, hours: 0, minutes: 0 })).toEqual({ days: 0, hours: 0, minutes: 5 });
    expect(normalizeDuration({ days: 0, hours: 0, minutes: 20 })).toEqual({ days: 0, hours: 0, minutes: 20 });
  });
  it('valores fora da faixa ficam dentro', () => {
    expect(normalizeDuration({ days: 9, hours: 0, minutes: 0 })).toEqual({ days: 7, hours: 0, minutes: 0 });
    expect(normalizeDuration({ days: 1, hours: 30, minutes: 90 })).toEqual({ days: 1, hours: 23, minutes: 59 });
  });
  it('listas de cada campo dependem dos outros', () => {
    expect(dayOptions()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(hourOptions({ days: 7, hours: 0, minutes: 0 })).toEqual([0]);
    expect(hourOptions({ days: 1, hours: 0, minutes: 0 })).toHaveLength(24);
    expect(minuteOptions({ days: 7, hours: 0, minutes: 0 })).toEqual([0]);
    expect(minuteOptions({ days: 0, hours: 0, minutes: 5 })[0]).toBe(5);
    expect(minuteOptions({ days: 0, hours: 1, minutes: 0 })).toHaveLength(60);
  });
  it('em minutos', () => {
    expect(durationMinutes({ days: 1, hours: 2, minutes: 3 })).toBe(1440 + 120 + 3);
  });
});

describe('opções e pronto para postar', () => {
  it('tira as vazias e os espaços', () => expect(cleanOptions([' Sim ', '', '  ', 'Não'])).toEqual(['Sim', 'Não']));
  it('precisa da pergunta e de 2 opções preenchidas', () => {
    expect(pollReady('Bora?', ['Sim', 'Não'])).toBe(true);
    expect(pollReady('  ', ['Sim', 'Não'])).toBe(false);
    expect(pollReady('Bora?', ['Sim', ''])).toBe(false);
    expect(pollReady('Bora?', ['', 'Sim', '', 'Não'])).toBe(true);
  });
});

describe('resultado', () => {
  it('porcentagens arredondadas; sem votos é 0%', () => {
    expect(pollPercents([1, 3])).toEqual([25, 75]);
    expect(pollPercents([1, 1, 1])).toEqual([33, 33, 33]);
    expect(pollPercents([0, 0])).toEqual([0, 0]);
  });
  it('mais votadas (empate vale; sem votos, nenhuma)', () => {
    expect(pollWinners([2, 5, 5])).toEqual([1, 2]);
    expect(pollWinners([0, 0])).toEqual([]);
  });
  it('total de votos', () => {
    expect(votesLabel(1)).toBe('1 voto');
    expect(votesLabel(0)).toBe('0 votos');
    expect(votesLabel(12)).toBe('12 votos');
  });
});

describe('tempo restante', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  const at = (ms: number) => new Date(now + ms).toISOString();
  const MIN = 60_000;
  it('dias, horas, minutos', () => {
    expect(pollTimeLeft(at(2 * 1440 * MIN + 5 * MIN), now)).toBe('faltam 2 dias');
    expect(pollTimeLeft(at(1440 * MIN), now)).toBe('falta 1 dia');
    expect(pollTimeLeft(at(3 * 60 * MIN), now)).toBe('faltam 3 h');
    expect(pollTimeLeft(at(60 * MIN), now)).toBe('falta 1 h');
    expect(pollTimeLeft(at(12 * MIN), now)).toBe('faltam 12 min');
    expect(pollTimeLeft(at(MIN), now)).toBe('falta 1 min');
    expect(pollTimeLeft(at(20_000), now)).toBe('menos de 1 min');
  });
  it('acabou: null', () => {
    expect(pollTimeLeft(at(0), now)).toBeNull();
    expect(pollTimeLeft(at(-MIN), now)).toBeNull();
  });
});
