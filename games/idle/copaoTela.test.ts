// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LugarEstado, NotaCaderninho } from '../shared/types';
import {
  avaliar, BASES, DJS, nomeSugerido, precoFaixa, precoRef, type CopaoCup, type CopaoNaNoite, type EstadoCup, type HojeCup, type UltimaNoite,
} from './copao';
import { chaveNoite, chaveRevelado, criarCopao, vendidoHoje } from './copaoTela';
import { MECANICAS } from './mecanicas';

const H = 3600_000;
/** Terça, 13/10, 12h de Brasília: a noite de hoje começa às 18h (21h UTC). */
const AGORA = Date.parse('2026-10-13T15:00:00Z');
const INI = Date.parse('2026-10-13T21:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
const REV = chaveRevelado(null);
const NOITE = chaveNoite(null);

let proxId = 100;
/** Um copão já revelado (estreou ontem), com a nota e as partes da conta de verdade. */
const copao = (x: Partial<CopaoCup> = {}): CopaoCup => {
  const base = x.base ?? 2, mistura = x.mistura ?? 1, extra = x.extra ?? 1, tamanho = x.tamanho ?? 2, forca = x.forca ?? 5, preco = x.preco ?? 20;
  const av = avaliar({ base, mistura, extra, tamanho, forca, preco }, '2026-10-12');
  return {
    id: proxId++, nome: 'Copão do Grau', base, mistura, extra, tamanho, forca, preco, nivel: 1, entrou_em: iso(INI - 30 * H), primeira_noite: iso(INI - 24 * H),
    saiu_em: null, revelado: true, noites: 1, vendido: 40, fichas: 400, nota: av.nota, sabor: av.sabor, cb: av.custoBeneficio, moda: av.moda,
    aguenta: av.aguenta, rotulos: av.rotulos, chance_pt: av.chancePT, vendido_hoje: null, fichas_hoje: null, ...x,
  };
};
/** Posto agora: estreia hoje às 18h (sem nota ainda). */
const novo = (x: Partial<CopaoCup> = {}) => copao({
  entrou_em: iso(AGORA - H), primeira_noite: iso(INI), revelado: false, noites: 0, vendido: 0, fichas: 0, nota: null, sabor: null, cb: null,
  moda: null, aguenta: null, rotulos: null, chance_pt: null, ...x,
});
const hoje = (x: Partial<HojeCup> = {}): HojeCup => ({
  inicio: iso(INI), fim: iso(INI + 8 * H), sexta: false, aberta: true, dj: null, vendido_ate_agora: 0, fichas_ate_agora: 0, ...x,
});
const naNoite = (c: CopaoCup, x: Partial<CopaoNaNoite> = {}): CopaoNaNoite => ({
  id: c.id, nome: c.nome, base: c.base, mistura: c.mistura, extra: c.extra, tamanho: c.tamanho, forca: c.forca, preco: c.preco, nota: c.nota ?? 500,
  vendidos: 40, fichas: 400, pt: false, ...x,
});
const ultima = (cs: CopaoCup[], x: Partial<UltimaNoite> = {}): UltimaNoite => ({
  inicio: iso(INI - 24 * H), fim: iso(INI - 16 * H), sexta: false, dj: null, vendas: 40, fichas: 400, pt: false, galera_delta: 3, chat_seed: 280,
  copoes: cs.map((c) => naNoite(c)), saiu_antes: 0, ...x,
});
const estado = (x: Partial<EstadoCup> = {}): EstadoCup => ({
  moda: { base: 4, mistura: 3 }, dj: 1, vagas: 3, cardapio: [], hoje: hoje(), ultima_noite: null, noite_fechada: null, historico: [], ...x,
});
const lugar = (mec: EstadoCup | null, x: Partial<LugarEstado> = {}): LugarEstado => ({
  id: 4, moeda_nome: 'ficha', numero: 'nota', lancado: true, nome: null, frase: null, icone: null,
  aberto: true, nivel: 1, moeda: 0, fas: 0, volume: 0, lendario: false, marcos: [], preco_nivel: 300,
  desafio: null, podio: [], semana: [], dono: null, caderninho: [], mecanica: mec, server_now: iso(AGORA), ...x,
});

let acao: ReturnType<typeof vi.fn<(fn: string, args: Record<string, unknown>) => void>>;
let recarregar: ReturnType<typeof vi.fn<() => void>>;
let ligar: ReturnType<typeof vi.fn<(alvo: HTMLElement, chave: string, titulo: string, texto: () => string | null) => void>>;
const montar = (uid: string | null = null) => {
  const mec = criarCopao();
  const t = mec.criar({ acao, recarregar, usuario: () => uid }, { ligar });
  document.body.replaceChildren(t.elemento);
  return { mec, t, $: <E extends Element = HTMLElement>(s: string) => t.elemento.querySelector<E & Element>(s) as E,
    $$: <E extends Element = HTMLElement>(s: string) => [...t.elemento.querySelectorAll<E & Element>(s)] as E[] };
};
const caixinha = (chave: string) => {
  const c = ligar.mock.calls.filter((x) => x[1] === chave).at(-1);
  return c ? (c[3] as () => string | null)() : undefined;
};
/** Marca como vistos (pra cair direto no bar). */
const viu = (ids: number[], noites: number[] = []) => {
  localStorage.setItem(REV, JSON.stringify(ids));
  localStorage.setItem(NOITE, JSON.stringify(noites));
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  localStorage.clear();
  acao = vi.fn<(fn: string, args: Record<string, unknown>) => void>();
  recarregar = vi.fn<() => void>();
  ligar = vi.fn<(alvo: HTMLElement, chave: string, titulo: string, texto: () => string | null) => void>();
});
afterEach(() => vi.useRealTimers());

describe('bar: hoje à noite e o cardápio', () => {
  it('antes das 18h: fechado, o relógio até abrir; vagas livres e as que ainda vão chegar', () => {
    const { t, $, $$ } = montar();
    t.renderizar(lugar(estado()), false, AGORA);
    expect(t.elemento.dataset.estado).toBe('bar');
    expect($('.cup-status').textContent).toBe('Fechado');
    expect($('.cup-conta').textContent).toBe('Abre em 6 h');
    expect($$('.cup-vaga.livre')).toHaveLength(3);
    expect($('.cup-montar-vaga').textContent).toContain('Montar o primeiro copão');
    expect($$('.cup-vaga.trancada').map((v) => v.textContent)).toEqual(['nív. 12', 'nív. 20']);
    expect($('.cup-rot-valor').textContent).toBe('0 de 3 vagas');
    vi.advanceTimersByTime(30 * 60_000);
    expect($('.cup-conta').textContent).toBe('Abre em 5 h 30 min');
  });
  it('cada copão: foto, nome, nota (ou "estreia hoje às 18h"), novidade e vendas; a caixinha da vaga diz as partes', () => {
    const a = copao({ id: 1, nome: 'Bomba Sem Freio' });
    const b = novo({ id: 2, nome: 'Balde da Casa', tamanho: 3, preco: 60 });
    viu([1], [280]);
    const { t, $$ } = montar();
    t.renderizar(lugar(estado({ cardapio: [a, b], ultima_noite: ultima([a]) })), false, AGORA);
    const vagas = $$('.cup-vaga:not(.livre):not(.trancada)');
    expect(vagas).toHaveLength(2);
    expect(vagas[0].querySelector('.cup-vaga-nome')!.textContent).toBe('Bomba Sem Freio');
    expect(vagas[0].querySelector('.cup-vaga-nota b')!.textContent).toBe(String(a.nota));
    expect(vagas[0].querySelector('canvas')!.getAttribute('aria-label')).toContain('Copão de Cachaça');
    expect(vagas[0].textContent).toContain('Novidade 90%');
    expect(vagas[0].querySelector('.cup-vaga-vendas')!.textContent).toBe('Ontem: 40 vendidos');
    expect(vagas[1].querySelector('.cup-estreia')!.textContent).toBe('Estreia hoje às 18h');
    expect(vagas[1].textContent).toContain('Novidade 100%');
    expect(caixinha('cup-vaga-1')).toBe(`Nota ${a.nota}: sabor ${a.sabor} · custo-benefício ${a.cb} · moda ${a.moda} · aguenta ${a.aguenta}. `
      + 'Novidade 90%: cai 10% por noite no cardápio, até 30%. É da receita: tirar e pôr de novo não zera. No total: 40 vendidos, 400 fichas.');
    expect(caixinha('cup-vaga-2')).toContain('A nota sai quando ele vender a primeira noite inteira');
  });
  it('a sexta e o DJ: retrato, nome, som e as bases que vendem mais, na tela (o celular não tem caixinha)', () => {
    const { t, $ } = montar();
    t.renderizar(lugar(estado({ dj: 1 })), false, AGORA);
    expect($('.cup-sexta-tit').textContent).toBe('Na sexta: movimento ×2');
    expect($('.cup-sexta .cup-dj-nome').textContent).toBe('DJ Vaqueiro');
    expect($('.cup-sexta .cup-dj-estilo').textContent).toBe('piseiro · DJ da sexta');
    expect($('.cup-sexta .cup-curte').textContent).toBe('+20% em copão de Cachaça, Catuaba e Vinho de garrafão');
    expect(caixinha('cup-dj-sexta')).toBe('Toca piseiro. Na sexta, copão de Cachaça, Catuaba ou Vinho de garrafão vende 20% mais. É o DJ da sua sexta.');
    // hoje é sexta e a noite já começou: o DJ gravado na noite
    t.renderizar(lugar(estado({ dj: 1, hoje: hoje({ sexta: true, dj: 2, vendido_ate_agora: 1 }) }), { server_now: iso(INI + H) }), false, INI + H);
    expect($('.cup-sexta-tit').textContent).toBe('Hoje é sexta: movimento ×2');
    expect($('.cup-sexta .cup-dj-nome').textContent).toBe('DJ Ramemes');
    // a sexta começou sem DJ e a pessoa escolheu um depois: hoje fica sem, o escolhido vale na próxima
    t.renderizar(lugar(estado({ dj: 1, hoje: hoje({ sexta: true, dj: null, vendido_ate_agora: 1 }) }), { server_now: iso(INI + H) }), false, INI + H);
    expect($('.cup-sexta .cup-dj-nome').textContent).toBe('Sem DJ');
    expect($('.cup-dj-proxima').textContent).toBe('Na próxima sexta: DJ Vaqueiro.');
    $<HTMLButtonElement>('.cup-trocar-dj').click();
    expect($('.cup-djs-tit .sub').textContent).toBe('A sexta de hoje já começou com o DJ dela: a troca vale a partir da próxima sexta.');
    $<HTMLButtonElement>('.cup-djs-voltar').click();
    // sem DJ
    t.renderizar(lugar(estado({ dj: null })), false, AGORA);
    expect($('.cup-sexta .cup-dj-nome').textContent).toBe('Sem DJ');
    expect($('.cup-trocar-dj').textContent).toBe('Escolher DJ');
  });
  it('noite aberta: o relógio até as 2h e as vendas subindo (a conta do banco seguida na mesma reta)', () => {
    const a = copao({ id: 3, vendido_hoje: 12, fichas_hoje: 120 });
    const b = copao({ id: 4, base: 1, nome: 'Copão de Vodka', vendido_hoje: 8, fichas_hoje: 80 });
    viu([3, 4]);
    vi.setSystemTime(INI + 2 * H);
    const { t, $, $$ } = montar();
    t.renderizar(lugar(estado({ cardapio: [a, b], hoje: hoje({ vendido_ate_agora: 20, fichas_ate_agora: 200 }) }), { server_now: iso(INI + 2 * H) }), false, INI + 2 * H);
    expect($('.cup-status').textContent).toBe('Aberto');
    expect($('.cup-conta').textContent).toBe('Fecha em 6 h');
    expect($('.cup-vendas').textContent).toBe('20 vendidos · +200 fichas');
    expect($$('.cup-vaga-vendas').map((v) => v.textContent)).toEqual(['Hoje: 12 vendidos', 'Hoje: 8 vendidos']);
    vi.advanceTimersByTime(2 * H);
    expect($('.cup-vendas').textContent).toBe('40 vendidos · +400 fichas');
    expect($$('.cup-vaga-vendas').map((v) => v.textContent)).toEqual(['Hoje: 24 vendidos', 'Hoje: 16 vendidos']);
    expect(recarregar).not.toHaveBeenCalled(); // o JSON já é de depois das 18h
  });
  it('chegou a hora: pede o lugar de novo (às 18h pras estreias, às 2h pro chat), uma vez cada', () => {
    const { t } = montar();
    t.renderizar(lugar(estado({ cardapio: [novo({ id: 5 })] })), false, AGORA);
    vi.advanceTimersByTime(6 * H + 1000);
    expect(recarregar).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000); // veio igual (o copão ainda sem nota): mais uma tentativa
    expect(recarregar).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(8 * H); // às 2h, e mais uma tentativa (a noite veio igual)
    expect(recarregar).toHaveBeenCalledTimes(4);
  });
  it('noite aberta no prejuízo: as fichas descem; o que saiu no meio da noite fica parado no total', () => {
    const a = copao({ id: 6, vendido_hoje: 10, fichas_hoje: -30 });
    viu([6]);
    vi.setSystemTime(INI + 2 * H);
    const { t, $ } = montar();
    // um copão que saiu às 19h vendeu 5 (−10 fichas) e parou: está no total, não no cardápio
    t.renderizar(lugar(estado({ cardapio: [a], hoje: hoje({ vendido_ate_agora: 15, fichas_ate_agora: -40 }) }), { server_now: iso(INI + 2 * H) }),
      false, INI + 2 * H);
    expect($('.cup-vendas').textContent).toBe('15 vendidos · −40 fichas');
    vi.advanceTimersByTime(2 * H);
    expect($('.cup-vendas').textContent).toBe('25 vendidos · −70 fichas');
    vi.advanceTimersByTime(3 * H); // 1h: 5 parados + 10 · 3,5
    expect($('.cup-vendas').textContent).toBe('40 vendidos · −115 fichas');
  });
  it('estreando hoje: vende, mas a nota só sai quando a noite fechar', () => {
    const c = novo({ id: 7, vendido_hoje: 6, fichas_hoje: 60 });
    vi.setSystemTime(INI + 2 * H);
    const { t, $ } = montar();
    t.renderizar(lugar(estado({ cardapio: [c], hoje: hoje({ vendido_ate_agora: 6, fichas_ate_agora: 60 }) }), { server_now: iso(INI + 2 * H) }),
      false, INI + 2 * H);
    expect(t.elemento.dataset.estado).toBe('bar');
    expect($('.cup-estreia').textContent).toBe('Estreando: nota às 2h');
    expect($('.cup-vaga-vendas').textContent).toBe('Hoje: 6 vendidos');
  });
  it('noite que ninguém abriu: diz por quê', () => {
    vi.setSystemTime(INI + H);
    const { t, $ } = montar();
    t.renderizar(lugar(estado({ hoje: hoje({ aberta: false }) }), { server_now: iso(INI + H) }), false, INI + H);
    expect($('.cup-status').textContent).toBe('Fechado hoje');
    expect($('.cup-noite-linha').textContent).toContain('Ninguém abriu o bar');
  });
  it('Tirar confirma dentro da vaga: Deixa volta; Tirar chama com o id', () => {
    const a = copao({ id: 6 });
    viu([6]);
    const confirmar = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmar);
    const { t, $ } = montar();
    t.renderizar(lugar(estado({ cardapio: [a] })), false, AGORA);
    $<HTMLButtonElement>('.cup-tirar').click();
    expect($('.cup-confirma').textContent).toContain('Sai do cardápio pra sempre.');
    $<HTMLButtonElement>('.cup-tirar-nao').click();
    expect($('.cup-confirma')).toBeNull();
    $<HTMLButtonElement>('.cup-tirar').click();
    $<HTMLButtonElement>('.cup-tirar-sim').click();
    expect(acao).toHaveBeenCalledWith('idle_cup_tirar', { p_copao: 6 });
    expect(confirmar).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('a última noite fechada sem ninguém: uma linha no pé com o dia ("ontem" ou o dia da semana)', () => {
    const { t, $ } = montar();
    t.renderizar(lugar(estado({ noite_fechada: { inicio: iso(INI - 24 * H), fim: iso(INI - 16 * H) } })), false, AGORA);
    expect($('.cup-fechada').textContent).toBe('Ninguém abriu o bar ontem');
    t.renderizar(lugar(estado({ noite_fechada: { inicio: iso(INI - 3 * 24 * H), fim: iso(INI - 3 * 24 * H + 8 * H) } })), false, AGORA);
    expect($('.cup-fechada').textContent).toBe('Ninguém abriu o bar no sábado');
    t.renderizar(lugar(estado({ noite_fechada: { inicio: iso(INI - 2 * 24 * H), fim: iso(INI - 2 * 24 * H + 8 * H) } })), false, AGORA);
    expect($('.cup-fechada').textContent).toBe('Ninguém abriu o bar no domingo');
    t.renderizar(lugar(estado()), false, AGORA);
    expect($('.cup-fechada')).toBeNull();
  });
  it('galera que não mudou (ou mudou menos de 0,5): "galera igual", nunca "+0" ou "−0"', () => {
    const a = copao({ id: 9 });
    viu([9], [280]);
    const { t, $ } = montar();
    t.renderizar(lugar(estado({ cardapio: [a], ultima_noite: ultima([a], { galera_delta: -0.3 }) })), false, AGORA);
    expect($('.cup-ontem-num').textContent).toBe('Ontem à noite40 vendidos · +400 fichas · galera igual');
    t.renderizar(lugar(estado({ cardapio: [a], ultima_noite: ultima([a], { galera_delta: 0 }) })), false, AGORA);
    expect($('.cup-ontem-num').textContent).toContain('galera igual');
    $<HTMLButtonElement>('.cup-ver-chat').click();
    expect([...t.elemento.querySelectorAll('.cup-chat-num dd')].map((d) => d.textContent)[2]).toBe('igual');
  });
  it('moda da semana à vista, dizendo que vale a semana em que o copão entra', () => {
    const { t, $ } = montar();
    t.renderizar(lugar(estado()), false, AGORA);
    expect($('.cup-moda').textContent).toBe('Moda da semanaGin + suco de laranjavale pra quem entrar no cardápio esta semana');
  });
});

describe('montar (vaga livre)', () => {
  const abrir = (x: Partial<EstadoCup> = {}, l: Partial<LugarEstado> = {}) => {
    const m = montar();
    m.t.renderizar(lugar(estado(x), l), false, AGORA);
    m.$<HTMLButtonElement>('.cup-montar-vaga').click();
    return m;
  };
  it('grades compactas: só o que liberou; o resto é um chip "nív. N +N"', () => {
    const { t, $, $$ } = abrir();
    expect(t.elemento.dataset.estado).toBe('montar');
    expect($$('.cup-base')).toHaveLength(3);
    expect($$('.cup-mistura')).toHaveLength(4);
    expect($$('.cup-extra')).toHaveLength(3);
    expect($$('.cup-tamanho')).toHaveLength(2);
    expect($('.cup-trancados-base').textContent).toBe('nív. 2+9');
    expect($('.cup-trancados-tamanho').textContent).toBe('nív. 7+1');
    expect(caixinha('cup-base-trancados')).toBe('Próximo: Gin, no nível 2. Depois mais 8 bases até o nível 19.');
    expect($$('.cup-base').map((b) => b.textContent!.replace(/alta|DJ/g, ''))).toEqual(['Vod', 'Cach', 'Catu']);
  });
  it('escolher: um marcado por grupo e o nome em cima; setas andam no grupo', () => {
    const { $, $$ } = abrir();
    $$<HTMLButtonElement>('.cup-base')[1].click();
    expect($$('.cup-base[aria-checked="true"]')).toHaveLength(1);
    expect($('.cup-sel-base').textContent).toBe('Cachaça');
    const misturas = $$<HTMLButtonElement>('.cup-mistura');
    misturas[0].focus();
    misturas[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(misturas[1]);
    expect($('.cup-sel-mistura').textContent).toBe('Refri de guaraná');
    expect($<HTMLInputElement>('.cup-nome').placeholder).toBe(nomeSugerido(2, 2, 1, 2, 0));
  });
  it('a moda (alta) e as bases que o DJ da sexta curte ficam marcadas', () => {
    const { $$ } = abrir({ moda: { base: 2, mistura: 1 }, dj: 1 }); // Vaqueiro: Cachaça, Catuaba, Vinho
    const bases = $$('.cup-base');
    expect(bases[1].querySelector('.cup-alta')).not.toBeNull();
    expect(bases[1].getAttribute('aria-label')).toBe('Cachaça, em alta, DJ Vaqueiro toca na sexta');
    expect(bases.map((b) => !!b.querySelector('.cup-dj-selo'))).toEqual([false, true, true]);
    expect($$('.cup-mistura')[0].querySelector('.cup-alta')).not.toBeNull();
  });
  it('moda trancada: diz qual é e em que nível libera', () => {
    const { $ } = abrir({ moda: { base: 4, mistura: 1 } });
    expect($('.cup-alta-trancada').textContent).toBe('Em alta: Gin (nív. 2)');
    expect($('.cup-moda-montar').textContent).toContain('A nota conta a moda da semana em que o copão entra no cardápio.');
  });
  it('força 1 a 10 e o que o caderninho já sabe dela na base (quão longe do ponto)', () => {
    // Cachaça (ponto 4): a 5 aguentou 199 (1 acima) e a 7 aguentou 35 (3 acima ou 4 abaixo → com a 5, fecha: ponto 4)
    const cad: NotaCaderninho[] = [{ tipo: 'aguenta', a: 2, b: 5, rotulo: 199 }, { tipo: 'aguenta', a: 2, b: 7, rotulo: 35 }];
    const { $, $$ } = abrir({}, { caderninho: cad });
    $$<HTMLButtonElement>('.cup-base')[1].click();
    const fs = $$<HTMLButtonElement>('.cup-f');
    expect(fs).toHaveLength(10);
    expect(fs[4].classList.contains('cup-f-testada')).toBe(true);
    expect(fs[3].classList.contains('cup-f-ponto')).toBe(true);
    expect(fs[4].getAttribute('aria-label')).toBe('Força 5: 1 acima do ponto');
    fs[4].click();
    expect($('.cup-forca-info').textContent).toBe('Cachaça na 5: 1 acima do ponto · PT 10% por noite.');
    fs[6].click();
    expect($('.cup-forca-info').textContent).toBe('Cachaça na 7: 3 acima do ponto · PT 30% por noite.');
    fs[1].click();
    expect($('.cup-forca-info').textContent).toBe('Ponto da Cachaça: força 4.');
    expect(caixinha('cup-forca')).toContain('Cachaça na força 2: 2 abaixo do ponto.');
    // base nunca testada
    $$<HTMLButtonElement>('.cup-base')[0].click();
    expect($('.cup-forca-info').textContent).toBe('Nunca testou a Vodka. A estreia conta quão longe do ponto ficou.');
    expect(caixinha('cup-forca')).toContain('Ainda não testou a Vodka na força 2.');
  });
  it('preço: começa na referência, anda dentro da faixa, mostra faixa, referência e lucro', () => {
    const { $, $$ } = abrir();
    // Copão de vodka força 5: referência 31,5
    const [lo, hi] = precoFaixa(1, 2, 5);
    const range = $<HTMLInputElement>('.cup-preco-range');
    expect(Number(range.value)).toBe(Math.round(precoRef(1, 2, 5)));
    expect([range.min, range.max]).toEqual([String(lo), String(hi)]);
    expect($('.cup-preco-info').textContent).toMatch(new RegExp(`^De ${lo} a ${hi} · ref\\. 32 · lucro de`));
    for (let i = 0; i < 80; i++) $<HTMLButtonElement>('.cup-preco-mais').click();
    expect(Number(range.value)).toBe(hi);
    expect($<HTMLButtonElement>('.cup-preco-mais').disabled).toBe(true);
    // trocar o tamanho pro copo prende o preço na faixa nova
    $$<HTMLButtonElement>('.cup-tamanho')[0].click();
    expect(Number($<HTMLInputElement>('.cup-preco-range').value)).toBe(precoFaixa(1, 1, 5)[1]);
    expect(caixinha('cup-preco')).toContain(`Vai de ${precoFaixa(1, 1, 5)[0]} a ${precoFaixa(1, 1, 5)[1]} fichas`);
    // a base pesa: a cachaça (mais barata) tem referência menor
    $$<HTMLButtonElement>('.cup-base')[1].click();
    expect(caixinha('cup-preco')).toContain(`referência ${precoRef(2, 1, 5).toLocaleString('pt-BR')}`);
  });
  it('o nome sugerido combina com o tamanho; o lucro de cada venda pequena tem uma casa', () => {
    const { $, $$ } = abrir();
    $$<HTMLButtonElement>('.cup-tamanho')[0].click(); // copo
    expect($<HTMLInputElement>('.cup-nome').placeholder).not.toMatch(/^(Copão|Bald)/);
    expect($<HTMLInputElement>('.cup-nome').placeholder).toBe(nomeSugerido(1, 1, 1, 1, 0));
    $$<HTMLButtonElement>('.cup-base')[1].click(); // cachaça, custo 1
    $$<HTMLButtonElement>('.cup-f')[5].click(); // força 6: custo 1,1, referência 1,1 · 1,5 + 7,5 = 9,15 → 9 fichas
    expect($('.cup-preco-info').textContent).toContain('lucro de 7,9 por venda');
    $<HTMLButtonElement>('.cup-preco-menos').click();
    for (let i = 0; i < 10; i++) $<HTMLButtonElement>('.cup-preco-menos').click();
    expect($('.cup-preco-info').textContent).toContain('lucro de 3,9 por venda'); // 5 fichas
  });
  it('Pôr no cardápio manda tudo com os nomes p_*; nome em branco vai o sugerido; deu certo volta pro bar', () => {
    const { t, $, $$ } = abrir();
    $$<HTMLButtonElement>('.cup-base')[2].click();
    $$<HTMLButtonElement>('.cup-f')[5].click();
    const por = $<HTMLButtonElement>('.cup-por');
    expect(por.disabled).toBe(false);
    expect($('.cup-aviso').textContent).toBe('Estreia hoje às 18h; a nota sai no fim da noite.');
    por.click();
    const preco = Math.round(precoRef(3, 2, 6));
    expect(acao).toHaveBeenCalledWith('idle_cup_por', {
      p_base: 3, p_mistura: 1, p_extra: 1, p_tamanho: 2, p_forca: 6, p_preco: preco, p_nome: nomeSugerido(3, 1, 1, 2, 0),
    });
    t.renderizar(lugar(estado({ cardapio: [novo({ id: 50, base: 3, forca: 6, preco })] })), false, AGORA);
    expect(t.elemento.dataset.estado).toBe('bar');
    expect($$('.cup-vaga-nome').map((x) => x.textContent)).toEqual(['Copão do Grau']);
  });
  it('o nome digitado vai sem espaço nas pontas e fica entre um desenho do banco e outro', () => {
    const { t, $ } = abrir();
    const nome = $<HTMLInputElement>('.cup-nome');
    nome.value = '  Bomba do Juan ';
    nome.focus();
    t.renderizar(lugar(estado(), { moeda: 50 }), false, AGORA);
    expect($<HTMLInputElement>('.cup-nome')).toBe(nome);
    expect(document.activeElement).toBe(nome);
    $<HTMLButtonElement>('.cup-por').click();
    expect(acao.mock.calls[0][1].p_nome).toBe('Bomba do Juan');
  });
  it('repetido no cardápio: não deixa; mesma base e mistura: avisa que os dois vendem menos; encheu: sem vaga pra montar', () => {
    const igual = copao({ id: 60, base: 1, mistura: 1, extra: 1, tamanho: 2 });
    viu([60, 61, 62]);
    const { t, $, $$ } = abrir({ cardapio: [igual] });
    expect($<HTMLButtonElement>('.cup-por').disabled).toBe(true);
    expect($('.cup-aviso').textContent).toContain('Esse copão já tá no cardápio');
    $$<HTMLButtonElement>('.cup-extra')[1].click();
    expect($<HTMLButtonElement>('.cup-por').disabled).toBe(false);
    expect($('.cup-aviso').textContent).toBe('Vodka com energético tradicional já tá no cardápio: os dois vendem 30% menos.');
    expect(caixinha('cup-por')).toContain('Estreia hoje às 18h');
    // encheu (o copão novo entrou): volta pro bar, sem vaga livre pra montar
    t.renderizar(lugar(estado({ cardapio: [igual, copao({ id: 61 }), copao({ id: 62, base: 3 })] })), false, AGORA);
    expect(t.elemento.dataset.estado).toBe('bar');
    expect($('.cup-montar-vaga')).toBeNull();
  });
  it('depois das 18h a estreia é amanhã; ocupado: nada clica; Voltar volta pro bar', () => {
    vi.setSystemTime(INI + H);
    const m = montar();
    m.t.renderizar(lugar(estado({ hoje: hoje({ vendido_ate_agora: 1 }) }), { server_now: iso(INI + H) }), false, INI + H);
    m.$<HTMLButtonElement>('.cup-montar-vaga').click();
    expect(m.$('.cup-aviso').textContent).toBe('Estreia amanhã às 18h; a nota sai no fim da noite.');
    m.t.renderizar(lugar(estado({ hoje: hoje({ vendido_ate_agora: 1 }) }), { server_now: iso(INI + H) }), true, INI + H);
    expect(m.$<HTMLButtonElement>('.cup-por').disabled).toBe(true);
    m.$<HTMLButtonElement>('.cup-voltar').click();
    expect(m.t.elemento.dataset.estado).toBe('bar');
  });
});

describe('caixinhas do montar', () => {
  it('base, mistura, extra e tamanho com o que o caderninho sabe', () => {
    const cad: NotaCaderninho[] = [
      { tipo: 'par', a: 101, b: 0, rotulo: 4 }, { tipo: 'par', a: 10101, b: 0, rotulo: 1 }, { tipo: 'aguenta', a: 1, b: 5, rotulo: 170 },
    ];
    const m = montar();
    m.t.renderizar(lugar(estado({ moda: { base: 1, mistura: 2 }, dj: 2 }), { caderninho: cad }), false, AGORA);
    m.$<HTMLButtonElement>('.cup-montar-vaga').click();
    expect(caixinha('cup-base-1')).toBe('Com energético tradicional: combinação ótima! Com limão: combinação ruim. Ponto: força 5. '
      + 'Em alta esta semana: a nota sobe. DJ Ramemes toca na sexta: +20% nas vendas.');
    expect(caixinha('cup-base-2')).toBe('Ainda não testou com energético tradicional. Ainda não testou com limão. Ponto de força: ainda não testou.');
    expect(caixinha('cup-mistura-2')).toBe('Ainda não testou com Vodka. Ainda não testou com limão. Em alta esta semana: a nota sobe.');
    expect(caixinha('cup-extra-1')).toBe('Com Vodka: combinação ruim. Ainda não testou com energético tradicional.');
    expect(caixinha('cup-tamanho-2')).toBe('3 doses. Com Vodka na força 5: referência 31,5 fichas, cada venda gasta 6. Sai menos que o copo: vende 37% das unidades.');
  });
});

describe('DJs da sexta', () => {
  it('os retratos dos liberados com o som e as bases; escolher chama idle_cup_dj; o resto num chip', () => {
    const { t, $, $$ } = montar();
    t.renderizar(lugar(estado({ dj: 1 })), false, AGORA);
    $<HTMLButtonElement>('.cup-trocar-dj').click();
    expect(t.elemento.dataset.estado).toBe('djs');
    const djs = $$<HTMLButtonElement>('.cup-dj:not(.trancado)');
    expect(djs.map((d) => d.querySelector('.cup-dj-nome')!.textContent)).toEqual(['DJ Vaqueiro', 'DJ Ramemes', 'Sem DJ']);
    expect(djs[1].querySelector('.cup-curte')!.textContent).toBe('+20%: Vodka, Whisky de posto e Corote de pêssego');
    expect(djs[0].getAttribute('aria-checked')).toBe('true');
    expect($$('.cup-retrato-dj')).toHaveLength(3);
    expect($('.cup-dj.trancado').textContent).toBe('nív. 3+8');
    djs[1].click();
    expect(acao).toHaveBeenCalledWith('idle_cup_dj', { p_dj: 2 });
    expect(t.elemento.dataset.estado).toBe('bar');
    $<HTMLButtonElement>('.cup-trocar-dj').click();
    $$<HTMLButtonElement>('.cup-dj')[2].click();
    expect(acao).toHaveBeenLastCalledWith('idle_cup_dj', { p_dj: null });
    expect(caixinha('cup-dj-2')).toContain('Toca funk.');
  });
});

describe('revelação (uma vez por copão, por pessoa)', () => {
  it('a nota sobe com as 4 partes; os pares, quão longe do ponto a força ficou e a chance de PT', () => {
    const c = copao({ id: 70, base: 2, forca: 5 }); // Cachaça, ponto 4: 1 acima
    const { t, $, $$ } = montar();
    t.renderizar(lugar(estado({ cardapio: [c] })), false, AGORA);
    expect(t.elemento.dataset.estado).toBe('revelacao');
    expect($('.cup-rev-nota').textContent).toBe('0');
    expect($$('.cup-parte').map((p) => p.querySelector('.cup-parte-rot')!.textContent)).toEqual(['Sabor', 'Custo-benefício', 'Moda', 'Aguenta']);
    vi.advanceTimersByTime(700);
    const meio = Number($('.cup-rev-nota').textContent);
    expect(meio).toBeGreaterThan(0);
    expect(meio).toBeLessThan(c.nota!);
    // o banco redesenha no meio: não recomeça
    t.renderizar(lugar(estado({ cardapio: [c] })), false, AGORA + 700);
    expect(Number($('.cup-rev-nota').textContent)).toBe(meio);
    vi.advanceTimersByTime(3000);
    expect($('.cup-rev-nota').textContent).toBe(String(c.nota));
    expect($$('.cup-parte-valor').map((v) => Number(v.textContent))).toEqual([c.sabor, c.cb, c.moda, c.aguenta]);
    expect($$('.cup-par')).toHaveLength(3);
    expect($$('.cup-par')[0].textContent).toMatch(/^Cachaça \+ energético tradicional: (péssima|ruim|ok|boa|ótima)$/);
    expect($('.cup-rev-forca').textContent).toBe('Força 5: 1 acima do ponto da Cachaça · chance de PT 10% por noite.');
    expect(localStorage.getItem(REV)).toBeNull();
    $<HTMLButtonElement>('.cup-rev-ver').click();
    expect(JSON.parse(localStorage.getItem(REV)!)).toEqual([70]);
    expect(t.elemento.dataset.estado).toBe('bar');
    t.renderizar(lugar(estado({ cardapio: [c] })), false, AGORA + 60_000);
    expect(t.elemento.dataset.estado).toBe('bar');
  });
  it('vários de uma vez: um depois do outro ("Próximo copão"), e depois o chat da noite', () => {
    const a = copao({ id: 71 });
    const b = copao({ id: 72, base: 1 });
    const { t, $ } = montar();
    t.renderizar(lugar(estado({ cardapio: [a, b], ultima_noite: ultima([a, b], { chat_seed: 900 }) })), false, AGORA);
    expect($<HTMLButtonElement>('.cup-rev-ver').textContent).toBe('Próximo copão');
    $<HTMLButtonElement>('.cup-rev-ver').click();
    expect(t.elemento.dataset.estado).toBe('revelacao');
    expect($<HTMLButtonElement>('.cup-rev-ver').textContent).toBe('Ver a noite');
    $<HTMLButtonElement>('.cup-rev-ver').click();
    expect(t.elemento.dataset.estado).toBe('chat');
  });
  it('sai no meio e volta: recomeça; outra pessoa no mesmo aparelho vê de novo', () => {
    const c = copao({ id: 73 });
    const { t, $ } = montar();
    t.renderizar(lugar(estado({ cardapio: [c] })), false, AGORA);
    vi.advanceTimersByTime(800);
    t.elemento.remove();
    vi.advanceTimersByTime(2000);
    document.body.replaceChildren(t.elemento);
    t.renderizar(lugar(estado({ cardapio: [c] })), false, AGORA + 3000);
    expect($('.cup-rev-nota').textContent).toBe('0');
    vi.advanceTimersByTime(5000);
    expect($('.cup-rev-nota').textContent).toBe(String(c.nota));
    localStorage.setItem('fellas:cup-revelado:ana', '[74]');
    const ana = montar('ana');
    ana.t.renderizar(lugar(estado({ cardapio: [copao({ id: 74 })] })), false, AGORA);
    expect(ana.t.elemento.dataset.estado).toBe('bar');
    const bia = montar('bia');
    bia.t.renderizar(lugar(estado({ cardapio: [copao({ id: 74 })] })), false, AGORA);
    expect(bia.t.elemento.dataset.estado).toBe('revelacao');
  });
  it('sem localStorage: revela uma vez e não volta em loop', () => {
    const ler = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const gravar = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const { t, $ } = montar();
    t.renderizar(lugar(estado({ cardapio: [copao({ id: 75 })] })), false, AGORA);
    $<HTMLButtonElement>('.cup-rev-ver').click();
    t.renderizar(lugar(estado({ cardapio: [copao({ id: 75 })] })), false, AGORA + 1000);
    expect(t.elemento.dataset.estado).toBe('bar');
    ler.mockRestore();
    gravar.mockRestore();
  });
});

describe('ontem à noite (o chat, uma vez por noite)', () => {
  it('o chat entra mensagem por mensagem; os números da noite; Abrir o bar guarda; Ver o chat reabre', () => {
    const a = copao({ id: 80, nome: 'Bomba de Cachaça' });
    viu([80]);
    const u = ultima([a], { chat_seed: 301, vendas: 84.6, fichas: 912.4, galera_delta: 3.2 });
    const { t, $, $$ } = montar();
    t.renderizar(lugar(estado({ cardapio: [a], ultima_noite: u })), false, AGORA);
    expect(t.elemento.dataset.estado).toBe('chat');
    expect($('.cup-chat .cup-titulo').textContent).toBe('Ontem à noite');
    expect($$('.cup-chat-num dd').map((d) => d.textContent)).toEqual(['84', '+912', '+3']);
    const msgs = $$('.cup-msg');
    expect(msgs.length).toBeGreaterThanOrEqual(8);
    expect(msgs.length).toBeLessThanOrEqual(12);
    expect(msgs.filter((m) => m.classList.contains('entrou'))).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(msgs.filter((m) => m.classList.contains('entrou')).length).toBeGreaterThan(0);
    vi.advanceTimersByTime(10_000);
    expect(msgs.every((m) => m.classList.contains('entrou'))).toBe(true);
    expect($('.cup-chat-copoes').textContent).toContain('Bomba de Cachaça');
    $<HTMLButtonElement>('.cup-chat-ver').click();
    expect(JSON.parse(localStorage.getItem(NOITE)!)).toEqual([301]);
    expect(t.elemento.dataset.estado).toBe('bar');
    expect($('.cup-ontem-num').textContent).toBe('Ontem à noite84 vendidos · +912 fichas · galera +3');
    $<HTMLButtonElement>('.cup-ver-chat').click();
    expect(t.elemento.dataset.estado).toBe('chat');
    $<HTMLButtonElement>('.cup-chat-ver').click();
    t.renderizar(lugar(estado({ cardapio: [a], ultima_noite: u })), false, AGORA + 1000);
    expect(t.elemento.dataset.estado).toBe('bar');
  });
  it('copões que saíram antes da nota: nada de "cardápio vazio"; a lista mostra o que eles venderam (bate com os números)', () => {
    const a = copao({ id: 82, nome: 'Fica' });
    viu([82]);
    {
      const { t, $, $$ } = montar();
      t.renderizar(lugar(estado({ cardapio: [], ultima_noite: ultima([], { saiu_antes: 2, vendas: 40.2, fichas: 120, chat_seed: 304 }) })), false, AGORA);
      expect($('.cup-chat-lado .sub').textContent).toBe('Das 18h às 2h.');
      expect($('.cup-chat-copoes').textContent).toBe('2 copões saíram antes da nota: 40 vendidos · +120 fichas');
      expect($$('.cup-msg').map((m) => m.textContent).join(' ')).not.toMatch(/vazio|não tinha copão/);
      t.elemento.remove();
    }
    {
      const { t, $, $$ } = montar();
      const u = ultima([a], { saiu_antes: 1, vendas: 50, fichas: 450, chat_seed: 305 });
      t.renderizar(lugar(estado({ cardapio: [a], ultima_noite: u })), false, AGORA);
      const linhas = $$('.cup-chat-copoes li').map((li) => li.textContent);
      expect(linhas).toHaveLength(2);
      expect(linhas[1]).toBe('1 copão saiu antes da nota: 10 vendidos · +50 fichas');
      t.elemento.remove();
    }
    {
      const { t, $ } = montar();
      t.renderizar(lugar(estado({ cardapio: [], ultima_noite: ultima([], { vendas: 0, fichas: 0, chat_seed: 306 }) })), false, AGORA);
      expect($('.cup-chat-lado .sub').textContent).toBe('Das 18h às 2h, com o cardápio vazio.');
      t.elemento.remove();
    }
  });
  it('PT e sexta com DJ: o aviso do PT; o DJ só aparece como "tocou"', () => {
    const a = copao({ id: 81, base: 2, forca: 9 });
    viu([81]);
    const u = ultima([a], { chat_seed: 302, pt: true, galera_delta: -12, sexta: true, dj: 1, fichas: -20 });
    u.copoes[0].pt = true;
    const { t, $, $$ } = montar();
    t.renderizar(lugar(estado({ cardapio: [a], ultima_noite: u })), false, AGORA);
    expect($('.cup-pt-aviso').textContent).toBe('Deu PT: a galera caiu 15%.');
    expect($('.cup-chat-lado .sub').textContent).toBe('Sexta, DJ Vaqueiro tocou piseiro.');
    expect($$('.cup-chat-num div')[1].classList.contains('ruim')).toBe(true);
    expect($$('.cup-msg.pt').length).toBeGreaterThan(0);
    for (const m of $$('.cup-msg')) {
      for (const d of DJS) if (m.textContent!.includes(d.nome)) expect(m.querySelector('p')!.textContent).toMatch(new RegExp(`^${d.nome} tocou`));
    }
  });
  it('a noite mais velha que ontem diz o dia; a chave é por pessoa', () => {
    const a = copao({ id: 82 });
    localStorage.setItem('fellas:cup-revelado:ana', '[82]');
    localStorage.setItem('fellas:cup-noite:ana', '[303]');
    const ana = montar('ana');
    ana.t.renderizar(lugar(estado({ cardapio: [a], ultima_noite: ultima([a], { chat_seed: 303 }) })), false, AGORA);
    expect(ana.t.elemento.dataset.estado).toBe('bar');
    localStorage.setItem('fellas:cup-revelado:bia', '[82]');
    const bia = montar('bia');
    bia.t.renderizar(lugar(estado({ cardapio: [a], ultima_noite: ultima([a], { chat_seed: 303, inicio: iso(INI - 4 * 24 * H) }) })), false, AGORA);
    expect(bia.t.elemento.dataset.estado).toBe('chat');
    expect(bia.$('.cup-chat .cup-titulo').textContent).toBe('Na noite de sexta (09/10)');
  });
});

describe('caderninho', () => {
  const notas: NotaCaderninho[] = [
    { tipo: 'par', a: 201, b: 0, rotulo: 4 }, { tipo: 'par', a: 10201, b: 0, rotulo: 0 }, { tipo: 'par', a: 20101, b: 0, rotulo: 2 },
    { tipo: 'aguenta', a: 2, b: 5, rotulo: 199 }, { tipo: 'aguenta', a: 2, b: 7, rotulo: 35 }, { tipo: 'aguenta', a: 1, b: 5, rotulo: 35 },
  ];
  it('na faixa: o resumo e o botão que abre o completo no miolo', () => {
    const { mec, t } = montar();
    t.renderizar(lugar(estado(), { caderninho: notas }), false, AGORA);
    const r = mec.caderninho(notas);
    document.body.append(r);
    expect(r.querySelector('.cup-resumo-num')!.textContent).toBe('3 testados de 33 pares liberados'); // 3×4 + 3×3 + 4×3
    expect(r.querySelector('.cup-resumo-rot')!.textContent).toBe('1 ótima1 ok1 péssima');
    expect(r.querySelector('.cup-resumo-ponto')!.textContent).toBe('Ponto de força: 1 de 2 bases testadas');
    r.querySelector<HTMLButtonElement>('.cup-abrir-caderno')!.click();
    expect(t.elemento.dataset.estado).toBe('caderno');
    t.elemento.querySelector<HTMLButtonElement>('.cup-fechar-caderno')!.click();
    expect(t.elemento.dataset.estado).toBe('bar');
  });
  it('completo: as 3 tabelas de pares do que liberou e, por base, as forças testadas e o ponto', () => {
    const m = montar();
    m.t.renderizar(lugar(estado(), { caderninho: notas }), false, AGORA);
    m.mec.caderninho(notas).querySelector<HTMLButtonElement>('.cup-abrir-caderno')!.click();
    const tabelas = m.$$('.cup-tabela');
    expect(tabelas.map((x) => x.getAttribute('aria-label'))).toEqual(['Base × mistura', 'Base × extra', 'Mistura × extra']);
    expect(tabelas[0].querySelectorAll('td')).toHaveLength(12);
    expect(m.$('td.rot-4').getAttribute('aria-label')).toBe('Cachaça com energético tradicional: combinação ótima');
    expect(m.$('td.rot-0').getAttribute('aria-label')).toBe('Cachaça com limão: combinação péssima');
    expect(caixinha('cup-cad-0-2-1')).toBe('Combinação ótima!');
    const itens = m.$$('.cup-ponto-item');
    expect(itens.map((i) => i.querySelector('.cup-ponto-base')!.textContent)).toEqual(['Vodka', 'Cachaça']);
    expect(itens[1].querySelector('.cup-ponto-res')!.textContent).toBe('ponto 4');
    expect([...itens[1].querySelectorAll('.cup-ponto-f')].map((f) => f.getAttribute('aria-label')))
      .toEqual(['Força 5: 1 acima do ponto, aguenta 199', 'Força 7: 3 acima do ponto, aguenta 35']);
    expect(itens[0].querySelector('.cup-ponto-f')!.getAttribute('aria-label')).toBe('Força 5: 3 acima ou 4 abaixo do ponto, aguenta 35');
    expect(itens[0].querySelector('.cup-ponto-res')!.textContent).toBe('falta testar');
    expect(m.$('.cup-ponto-nunca').textContent).toBe('Ainda não testou: Catuaba.');
  });
});

describe('contas da tela e a mecânica registrada', () => {
  it('vendidoHoje segue a reta do banco até o fim da noite (prejuízo também); o parado não anda', () => {
    expect(vendidoHoje(20, INI, INI + 8 * H, INI + 2 * H, INI + 4 * H)).toBe(40);
    expect(vendidoHoje(20, INI, INI + 8 * H, INI + 2 * H, INI + 20 * H)).toBe(80);
    expect(vendidoHoje(0, INI, INI + 8 * H, INI + 2 * H, INI + 4 * H)).toBe(0);
    expect(vendidoHoje(5, INI, INI + 8 * H, INI - H, INI + 4 * H)).toBe(5);
    expect(vendidoHoje(-20, INI, INI + 8 * H, INI + 2 * H, INI + 4 * H)).toBe(-40);
    // 30 contados, 10 deles de um copão que já saiu: só os outros 20 andam
    expect(vendidoHoje(30, INI, INI + 8 * H, INI + 2 * H, INI + 4 * H, 10)).toBe(50);
    expect(vendidoHoje(-5, INI, INI + 8 * H, INI + 2 * H, INI + 4 * H, -15)).toBe(5);
  });
  it('MECANICAS[4] é o copão: libera, foto 48×48', () => {
    const m = MECANICAS[4]!;
    expect(m.libera(12)).toEqual(['Vaga no cardápio: 4ª', 'Mistura: Xarope de groselha']);
    expect(m.libera(3)).toEqual(['Extra: Maracujá', 'DJ: Neiff']);
    expect(m.libera(1)).toEqual([]);
    const f = m.foto([2, 1, 1, 2, 5]);
    expect([f.width, f.height]).toEqual([48, 48]);
    expect(m.foto([1]).width).toBe(48);
    expect(BASES[1].ponto).toBe(4);
  });
});
