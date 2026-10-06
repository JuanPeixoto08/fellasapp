import { applyVote, formatScore, IDEA_MAX, remainingLabel, validateIdea } from '../lib/ideas';

describe('applyVote', () => {
  it.each([
    // [meu voto antes, seta tocada, meu voto depois, variação da pontuação]
    [null, 1, 1, +1],
    [1, 1, null, -1],
    [-1, 1, 1, +2],
    [null, -1, -1, -1],
    [-1, -1, null, +1],
    [1, -1, -1, -2],
  ] as const)('voto %s, toca %s → %s (%s)', (before, tapped, after, delta) => {
    expect(applyVote({ score: 5, myVote: before }, tapped)).toEqual({ myVote: after, score: 5 + delta });
  });
});

describe('validateIdea', () => {
  it('apara e aceita de 1 a 280', () => {
    expect(validateIdea('  bora ter modo escuro  ')).toBe('bora ter modo escuro');
    expect(validateIdea('a'.repeat(IDEA_MAX))).toBe('a'.repeat(IDEA_MAX));
  });
  it('recusa vazio, só espaço/quebra de linha e mais de 280', () => {
    expect(validateIdea('')).toBeNull();
    expect(validateIdea(' \n\t ')).toBeNull();
    expect(validateIdea('a'.repeat(IDEA_MAX + 1))).toBeNull();
  });
});

describe('formatScore', () => {
  it('negativo com sinal de menos de verdade', () => {
    expect(formatScore(7)).toBe('7');
    expect(formatScore(0)).toBe('0');
    expect(formatScore(-3)).toBe('−3');
  });
});

describe('remainingLabel', () => {
  it('só aparece passando de 240', () => {
    expect(remainingLabel('a'.repeat(240))).toBeNull();
    expect(remainingLabel('a'.repeat(241))).toBe('39 restantes');
    expect(remainingLabel('a'.repeat(280))).toBe('0 restantes');
  });
});
