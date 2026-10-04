import { birthdayLabel, nextBirthdays, parseMonthDay } from '../lib/birthdays';

const m = (id: string, birthday: string | null) => ({ id, birthday });

describe('parseMonthDay', () => {
  it('lê AAAA-MM-DD sem passar por Date (não volta um dia em fuso negativo)', () => {
    expect(parseMonthDay('1999-05-20')).toEqual({ month: 4, day: 20 });
    expect(parseMonthDay('2000-01-01')).toEqual({ month: 0, day: 1 });
  });
  it.each([null, undefined, '', '20/05/1999', '1999-13-01', '1999-00-10'])('inválido %p → null', (v) => {
    expect(parseMonthDay(v)).toBeNull();
  });
});

describe('nextBirthdays', () => {
  const today = new Date(2026, 9, 4); // 4 out 2026

  it('ordena pela próxima data, com Hoje e Amanhã, e ignora quem não preencheu', () => {
    const list = nextBirthdays(
      [m('a', '1999-12-25'), m('b', '2001-10-04'), m('c', null), m('d', '1998-10-05'), m('e', '2000-11-02')],
      today,
    );
    expect(list.map((e) => [e.member.id, e.label])).toEqual([
      ['b', 'Hoje'],
      ['d', 'Amanhã'],
      ['e', '2 nov'],
    ]);
  });

  it('vira o ano: quem já fez aniversário aparece no ano que vem', () => {
    const [first] = nextBirthdays([m('a', '1999-01-10')], today);
    expect(first.label).toBe('10 jan');
    expect(first.daysUntil).toBe(98);
  });

  it('29/02 em ano não bissexto comemora em 28 fev', () => {
    const [first] = nextBirthdays([m('a', '2000-02-29')], new Date(2027, 1, 1));
    expect(first.label).toBe('28 fev');
  });

  it('limita a quantidade', () => {
    const many = ['2000-10-10', '2000-10-11', '2000-10-12', '2000-10-13'].map((b, i) => m(String(i), b));
    expect(nextBirthdays(many, today, 3)).toHaveLength(3);
  });
});

describe('birthdayLabel', () => {
  it('data curta em pt-BR', () => {
    expect(birthdayLabel(10, new Date(2026, 9, 14))).toBe('14 out');
  });
});
