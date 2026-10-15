import { describe, expect, it } from 'vitest';

import { comboAgora } from './combo';
import { eventoDaSorte } from './convidados';

const U = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const base = { user_id: U, generators: Array(30).fill(0) };
/** O 1º segundo depois de `de` com um dourado da sorte que passa no filtro. */
const proximo = (de: number, ok: (t: number) => boolean) => {
  for (let x = de + 1; ; x++) {
    const e = eventoDaSorte(base, x);
    if (e && ok(e.tipo)) return x;
  }
};

describe('o Combo em andamento na página (a mesma regra de idle_combo_quebrou)', () => {
  it('sem combo: 0', () => {
    expect(comboAgora({ ...base, combo_n: 0, combo_seg: null }, Date.now())).toBe(0);
    expect(comboAgora(base, Date.now())).toBe(0);
  });
  it('2 pegos e nenhum dourado perdido depois: 2', () => {
    const de = 1_760_000_000;
    const x = proximo(de, () => true);
    expect(comboAgora({ ...base, combo_n: 2, combo_seg: de }, (x - 1) * 1000)).toBe(2);
  });
  it('um dourado (não Tigrinho) passou da janela sem ser pego: quebrou; ainda na tela, não', () => {
    const de = 1_761_000_000;
    const x = proximo(de, (t) => t !== 7 && t !== 4 && t !== 6);
    expect(comboAgora({ ...base, combo_n: 2, combo_seg: de }, (x + 12) * 1000)).toBe(2); // 12 s na tela + 3 de folga
    expect(comboAgora({ ...base, combo_n: 2, combo_seg: de }, (x + 16) * 1000)).toBe(0);
  });
  it('Tigrinho ignorado não quebra', () => {
    let x = 1_762_000_000;
    for (;;) {
      x = proximo(x, (t) => t === 7);
      if (proximo(x, () => true) > x + 30) break; // o próximo dourado vem bem depois
    }
    expect(comboAgora({ ...base, combo_n: 1, combo_seg: x - 1 }, (x + 25) * 1000)).toBe(1);
  });
  it('o último pego há mais de 30 min: 0', () => {
    expect(comboAgora({ ...base, combo_n: 2, combo_seg: 1_763_000_000 }, (1_763_000_000 + 1801) * 1000)).toBe(0);
  });
});
