// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LugarEstado, NotaCaderninho } from '../shared/types';
import { nomeSugerido, pecasLote, type ColecaoTee, type EstadoTee } from './camisetaria';
import { criarCamisetaria, CHAVE_REVELADA } from './camisetariaTela';
import { MECANICAS } from './mecanicas';

const AGORA = Date.parse('2026-10-12T12:00:00Z');
const H = 3600_000;
const iso = (ms: number) => new Date(ms).toISOString();

const estadoTee = (x: Partial<EstadoTee> = {}): EstadoTee => ({
  tendencia: 2, lotes: [12, 36, 84], precos: { relatorio: 50 }, ativa: null, historico: [], semana: 0, ultimo_fiado: null, ...x,
});
const colecao = (x: Partial<ColecaoTee> = {}): ColecaoTee => ({
  id: 41, nome: 'Drop Praia Raiz', tema: 2, estilo: 3, peca: 1, cor: 3, arte: 6, tecido: 2, div: 2, lote: 1, nivel: 1, pecas: 36, custo: 108,
  fiado: false, tendencia: 2, criada_em: iso(AGORA - H), pronta_em: iso(AGORA + H), fim_em: iso(AGORA + 13 * H), vendido: 0, pronta: false,
  notas: null, media: null, procura: null, pct: null, rotulo: null, peca_tema: null, ...x,
});
const pronta = (x: Partial<ColecaoTee> = {}) => colecao({
  criada_em: iso(AGORA - 3 * H), pronta_em: iso(AGORA - H), fim_em: iso(AGORA + 11 * H), pronta: true,
  notas: [9, 8, 4, 7], media: 7, procura: 60, pct: 166.6, rotulo: 4, peca_tema: 1, ...x,
});
const lugar = (mec: EstadoTee | null, x: Partial<LugarEstado> = {}): LugarEstado => ({
  id: 3, moeda_nome: 'cupom', numero: 'pct', lancado: true, nome: null, frase: null, icone: null,
  aberto: true, nivel: 1, moeda: 108, fas: 0, volume: 0, lendario: false, marcos: [], preco_nivel: 240,
  desafio: null, podio: [], semana: [], dono: null, caderninho: [], mecanica: mec, server_now: iso(AGORA), ...x,
});

let acao: ReturnType<typeof vi.fn<(fn: string, args: Record<string, unknown>) => void>>;
let recarregar: ReturnType<typeof vi.fn<() => void>>;
let ligar: ReturnType<typeof vi.fn<(alvo: HTMLElement, chave: string, titulo: string, texto: () => string | null) => void>>;
const montar = () => {
  const mec = criarCamisetaria();
  const t = mec.criar({ acao, recarregar }, { ligar });
  document.body.replaceChildren(t.elemento);
  return { mec, t, $: <E extends Element = HTMLElement>(s: string) => t.elemento.querySelector<E & Element>(s) as E,
    $$: <E extends Element = HTMLElement>(s: string) => [...t.elemento.querySelectorAll<E & Element>(s)] as E[] };
};
/** O texto da caixinha ligada com a chave (a última vez que ligou). */
const caixinha = (chave: string) => {
  const c = ligar.mock.calls.filter((x) => x[1] === chave).at(-1);
  return c ? (c[3] as () => string | null)() : undefined;
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

describe('bancada (sem coleção rodando)', () => {
  it('grades de tema, estilo, peça e cor: só o que liberou; o resto é um cadeado só com quantos faltam', () => {
    const { t, $, $$ } = montar();
    t.renderizar(lugar(estadoTee()), false, AGORA);
    expect(t.elemento.dataset.estado).toBe('bancada');
    const temas = $$<HTMLButtonElement>('.tee-tema');
    expect(temas).toHaveLength(6);
    expect($$('.tee-estilo')).toHaveLength(3);
    expect($$('.tee-peca')).toHaveLength(2);
    expect($$('.tee-cor')).toHaveLength(4);
    const cad = $('.tee-trancados-tema');
    expect(cad.querySelector('.tee-niv')!.textContent).toBe('nív. 2'); // o próximo, à vista no celular (sem caixinha)
    expect(cad.querySelector('.tee-mais')!.textContent).toBe('+24');
    expect(cad.getAttribute('aria-label')).toBe('Próximo: Signo, no nível 2. Depois mais 23 temas até o nível 25.');
    expect(caixinha('tee-tema-trancados')).toBe('Próximo: Signo, no nível 2. Depois mais 23 temas até o nível 25.');
    expect($('.tee-trancados-peca').textContent).toBe('nív. 4+4');
    // o tema em alta da semana tem a etiqueta
    expect(temas[1].querySelector('.tee-alta')).not.toBeNull();
    expect(temas[1].getAttribute('aria-label')).toBe('Praia, em alta');
    // nível 25: tudo liberado, sem cadeado
    t.renderizar(lugar(estadoTee(), { nivel: 25 }), false, AGORA);
    expect($$('.tee-tema')).toHaveLength(30);
    expect($$('.tee-trancados')).toHaveLength(0);
  });
  it('escolher: só um marcado por grupo, o nome aparece e o trancado não muda nada', () => {
    const { t, $, $$ } = montar();
    t.renderizar(lugar(estadoTee()), false, AGORA);
    $$<HTMLButtonElement>('.tee-tema')[1].click();
    expect($$('.tee-tema[aria-checked="true"]')).toHaveLength(1);
    expect($$('.tee-tema')[1].getAttribute('aria-checked')).toBe('true');
    expect($('.tee-sel-tema').textContent).toBe('Praia');
    $<HTMLElement>('.tee-trancados-tema').click(); // o cadeado não escolhe nada
    expect($('.tee-sel-tema').textContent).toBe('Praia');
    $$<HTMLButtonElement>('.tee-estilo')[2].click();
    $$<HTMLButtonElement>('.tee-cor')[2].click();
    expect($('.tee-sel-estilo').textContent).toBe('Pixel');
    expect($('.tee-sel-cor').textContent).toBe('Amarelo');
    // o nome sugerido segue o tema e o estilo
    expect($<HTMLInputElement>('.tee-nome').placeholder).toBe(nomeSugerido(2, 3, 0));
  });
  it('setas do teclado andam no grupo (um item só no Tab)', () => {
    const { t, $$ } = montar();
    t.renderizar(lugar(estadoTee()), false, AGORA);
    const temas = $$<HTMLButtonElement>('.tee-tema');
    expect(temas.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    temas[0].focus();
    temas[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(temas[1]);
    expect(temas[1].getAttribute('aria-checked')).toBe('true');
  });
  it('foco: 3 contadores que somam 10; o + só com ponto sobrando', () => {
    const { t, $, $$ } = montar();
    t.renderizar(lugar(estadoTee()), false, AGORA);
    const valores = () => $$('.tee-foco-valor').map((v) => Number(v.textContent));
    expect(valores()).toEqual([4, 3, 3]);
    const mais = $$<HTMLButtonElement>('.tee-foco-mais');
    const menos = $$<HTMLButtonElement>('.tee-foco-menos');
    expect(mais.every((b) => b.disabled)).toBe(true);
    menos[1].click();
    expect(valores()).toEqual([4, 2, 3]);
    expect($('.tee-lancar').hasAttribute('disabled')).toBe(true);
    expect($('.tee-aviso').textContent).toContain('Sobra 1 ponto');
    mais[2].click();
    expect(valores()).toEqual([4, 2, 4]);
    expect($<HTMLButtonElement>('.tee-lancar').disabled).toBe(false);
  });
  it('lote: peças, custo e tempo de cada um', () => {
    const { t, $$ } = montar();
    t.renderizar(lugar(estadoTee()), false, AGORA);
    const lotes = $$('.tee-lote').map((b) => b.textContent);
    expect(lotes[0]).toContain('12 peças');
    expect(lotes[0]).toContain('36 cupons');
    expect(lotes[0]).toContain('1 h');
    expect(lotes[2]).toContain('84 peças');
    expect(lotes[2]).toContain('4 h');
  });
  it('Lançar manda tudo com os nomes p_*; nome em branco vai o sugerido', () => {
    const { t, $, $$ } = montar();
    t.renderizar(lugar(estadoTee()), false, AGORA);
    $$<HTMLButtonElement>('.tee-tema')[1].click();
    $$<HTMLButtonElement>('.tee-peca')[1].click();
    const lancar = $<HTMLButtonElement>('.tee-lancar');
    expect(lancar.textContent).toBe('Lançar por 72 cupons'); // ecobag (2) × 36 peças
    lancar.click();
    expect(acao).toHaveBeenCalledWith('idle_tee_lancar', {
      p_tema: 2, p_estilo: 1, p_peca: 2, p_cor: 1, p_arte: 4, p_tecido: 3, p_div: 3, p_lote: 1, p_nome: nomeSugerido(2, 1, 0),
    });
  });
  it('Sortear põe outro nome no campo; o nome digitado vai do jeito que está (sem espaço nas pontas)', () => {
    const { t, $ } = montar();
    t.renderizar(lugar(estadoTee()), false, AGORA);
    $<HTMLButtonElement>('.tee-sortear').click();
    expect($<HTMLInputElement>('.tee-nome').value).toBe(nomeSugerido(1, 1, 1));
    expect($<HTMLInputElement>('.tee-nome').maxLength).toBe(30);
    $<HTMLInputElement>('.tee-nome').value = '  Coleção do Juan ';
    $<HTMLButtonElement>('.tee-lancar').click();
    expect(acao.mock.calls[0][1].p_nome).toBe('Coleção do Juan');
  });
  it('sem cupom: desabilitado com quanto falta; no lote pequeno o fornecedor fia (1 vez por dia)', () => {
    const { t, $, $$ } = montar();
    t.renderizar(lugar(estadoTee(), { moeda: 20 }), false, AGORA);
    const lancar = $<HTMLButtonElement>('.tee-lancar');
    expect(lancar.disabled).toBe(true);
    expect($('.tee-aviso').textContent).toBe('Faltam 88 cupons. O lote pequeno sai fiado (1 vez por dia).');
    $$<HTMLButtonElement>('.tee-lote')[0].click();
    expect(lancar.disabled).toBe(false);
    expect(lancar.textContent).toBe('Lançar fiado');
    // já fiou há menos de 24 h: não dá
    t.renderizar(lugar(estadoTee({ ultimo_fiado: iso(AGORA - 2 * H) }), { moeda: 20 }), false, AGORA);
    expect($<HTMLButtonElement>('.tee-lancar').disabled).toBe(true);
    expect($('.tee-aviso').textContent).toContain('Faltam 16 cupons');
  });
  it('ocupado (a ação rodando): nada clica', () => {
    const { t, $ } = montar();
    t.renderizar(lugar(estadoTee()), true, AGORA);
    expect($<HTMLButtonElement>('.tee-lancar').disabled).toBe(true);
  });
  it('a escolha e o nome digitado ficam entre um desenho do banco e outro', () => {
    const { t, $, $$ } = montar();
    t.renderizar(lugar(estadoTee()), false, AGORA);
    $$<HTMLButtonElement>('.tee-tema')[3].click();
    const nome = $<HTMLInputElement>('.tee-nome');
    nome.value = 'Forró Raiz';
    nome.focus();
    t.renderizar(lugar(estadoTee(), { moeda: 500 }), false, AGORA);
    expect($('.tee-sel-tema').textContent).toBe('Forró');
    expect($<HTMLInputElement>('.tee-nome')).toBe(nome);
    expect(document.activeElement).toBe(nome);
  });
  it('o aviso embaixo do Lançar mostra uma mensagem só (a mais importante); a caixinha do Lançar mostra todas', () => {
    const { t, $, $$ } = montar();
    const historico = [{ id: 1, nome: 'x', tema: 1, estilo: 1, peca: 1, cor: 1, notas: [5, 5, 5, 5], pct: 50 }];
    // tudo ao mesmo tempo: foco sem fechar, sem cupom (o fiado vale no pequeno) e a repetição
    t.renderizar(lugar(estadoTee({ historico }), { moeda: 0 }), false, AGORA);
    $$<HTMLButtonElement>('.tee-foco-menos')[0].click();
    expect($('.tee-aviso').textContent).toBe('Sobra 1 ponto no foco.');
    const todas = caixinha('tee-lancar')!;
    expect(todas).toContain('Sobra 1 ponto no foco.');
    expect(todas).toContain('Faltam 108 cupons. O lote pequeno sai fiado (1 vez por dia).');
    expect(todas).toContain('Mesmo tema e estilo de uma das 3 últimas: a nota cai.');
    $$<HTMLButtonElement>('.tee-foco-mais')[0].click();
    expect($('.tee-aviso').textContent).toBe('Faltam 108 cupons. O lote pequeno sai fiado (1 vez por dia).');
    $$<HTMLButtonElement>('.tee-lote')[0].click();
    expect($('.tee-aviso').textContent).toBe('Sem cupom: o fornecedor fia esse lote (1 vez por dia).');
    // nenhum caso passa de uma mensagem
    for (const moeda of [0, 20, 5000]) for (const lote of [0, 1, 2]) for (const menos of [0, 1]) {
      t.renderizar(lugar(estadoTee({ historico }), { moeda }), false, AGORA);
      $$<HTMLButtonElement>('.tee-lote')[lote].click();
      if (menos) $$<HTMLButtonElement>('.tee-foco-menos')[0].click();
      const texto = $('.tee-aviso').textContent!;
      expect(caixinha('tee-lancar')!.startsWith(texto)).toBe(true);
      expect(caixinha('tee-lancar')!.length).toBeGreaterThan(texto.length); // sempre sobra o resto pra caixinha
      if (menos) $$<HTMLButtonElement>('.tee-foco-mais')[0].click();
    }
  });
  it('o "alta" segue a tendência que vem em cada desenho (a semana vira com a tela aberta)', () => {
    const { t, $$ } = montar();
    t.renderizar(lugar(estadoTee({ tendencia: 2 })), false, AGORA);
    expect($$('.tee-tema')[1].querySelector('.tee-alta')).not.toBeNull();
    t.renderizar(lugar(estadoTee({ tendencia: 5 })), false, AGORA);
    expect($$('.tee-alta')).toHaveLength(1);
    expect($$('.tee-tema')[4].querySelector('.tee-alta')).not.toBeNull();
    expect($$('.tee-tema')[4].getAttribute('aria-label')).toBe('Gato, em alta');
    expect($$('.tee-tema')[1].getAttribute('aria-label')).toBe('Praia');
    t.renderizar(lugar(estadoTee({ tendencia: 9 })), false, AGORA); // trancada no nível 1: nenhum
    expect($$('.tee-alta')).toHaveLength(0);
  });
  it('repetiu a última coleção: avisa que a nota cai', () => {
    const { t, $ } = montar();
    const historico = [{ id: 1, nome: 'x', tema: 1, estilo: 1, peca: 1, cor: 1, notas: [5, 5, 5, 5], pct: 50 }];
    t.renderizar(lugar(estadoTee({ historico })), false, AGORA);
    expect($('.tee-aviso').textContent).toContain('Mesmo tema e estilo de uma das 3 últimas: a nota cai.');
  });
});

describe('caixinhas da bancada', () => {
  const cad: NotaCaderninho[] = [{ tipo: 'combo', a: 1, b: 1, rotulo: 3 }, { tipo: 'foco', a: 1, b: 0, rotulo: 352 }];
  it('tema, estilo, peça, cor, foco e lote com o que o caderninho sabe', () => {
    const { t } = montar();
    t.renderizar(lugar(estadoTee(), { caderninho: cad }), false, AGORA);
    expect(caixinha('tee-tema-1')).toBe('Com Minimalista: Combinação boa.');
    expect(caixinha('tee-tema-3')).toBe('Ainda não testou com Minimalista.');
    expect(caixinha('tee-tema-2')).toBe('Ainda não testou com Minimalista. Em alta esta semana: a nota sobe.');
    expect(caixinha('tee-estilo-1')).toContain('Foco ideal: Arte 3 · Tecido 5 · Divulgação 2.');
    expect(caixinha('tee-peca-1')).toContain('Custa 3 cupons');
    expect(caixinha('tee-cor-3')).toBe('Cor forte: o @SuperMauro64 curte.');
    expect(caixinha('tee-foco')).toContain('O ideal do Minimalista');
    expect(caixinha('tee-lote-0')).toContain('12 peças por 36 cupons');
    // a caixinha segue a escolha de agora
    t.elemento.querySelectorAll<HTMLButtonElement>('.tee-estilo')[1].click();
    expect(caixinha('tee-tema-1')).toBe('Ainda não testou com Rabisco de caneta.');
  });
});

describe('produção', () => {
  it('contagem até ficar pronta; ao chegar a hora, pede o lugar de novo uma vez', () => {
    const { t, $ } = montar();
    t.renderizar(lugar(estadoTee({ ativa: colecao() }), { moeda: 0 }), false, AGORA);
    expect(t.elemento.dataset.estado).toBe('producao');
    expect($('.tee-conta').textContent).toBe('1 h');
    expect(t.elemento.textContent).toContain('Drop Praia Raiz');
    expect($('.tee-barra').getAttribute('aria-valuenow')).toBe('50');
    vi.advanceTimersByTime(30 * 60_000);
    expect($('.tee-conta').textContent).toBe('30 min');
    expect(recarregar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30 * 60_000 + 1000);
    expect(recarregar).toHaveBeenCalledTimes(1);
    // o lugar veio igual (nada redesenhou): mais uma tentativa 3 s depois, e só
    vi.advanceTimersByTime(3000);
    expect(recarregar).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(60_000);
    expect(recarregar).toHaveBeenCalledTimes(2);
  });
  it('a resposta chegou com a coleção pronta: sem segunda tentativa', () => {
    const { t } = montar();
    t.renderizar(lugar(estadoTee({ ativa: colecao({ id: 52, pronta_em: iso(AGORA + 1000) }) })), false, AGORA);
    vi.advanceTimersByTime(2000);
    expect(recarregar).toHaveBeenCalledTimes(1);
    t.renderizar(lugar(estadoTee({ ativa: pronta({ id: 52 }) })), false, AGORA + 2000);
    vi.advanceTimersByTime(5000);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });
});

describe('revelação (uma vez por coleção)', () => {
  it('os 4 posts entram um por um, a % sobe até o número e vem o rótulo; Ver a venda guarda que viu', () => {
    const { t, $, $$ } = montar();
    t.renderizar(lugar(estadoTee({ ativa: pronta() })), false, AGORA);
    expect(t.elemento.dataset.estado).toBe('revelacao');
    const posts = $$('.tee-post');
    expect(posts).toHaveLength(4);
    expect(posts.map((p) => p.querySelector('.tee-handle')!.textContent)).toEqual(['@hojetemjp', '@SuperMauro64', '@mcresenha', '@luisviton']);
    expect(posts.map((p) => p.querySelector('.tee-nota')!.textContent)).toEqual(['9', '8', '4', '7']);
    // praia em alta e o hojetemjp deu 9: comentário de quem gostou
    expect(posts[0].querySelector('.tee-comentario')!.textContent).toBe('Praia tá em alta e vocês entregaram. Já tô no carrinho.');
    expect(posts.filter((p) => p.classList.contains('entrou'))).toHaveLength(0);
    vi.advanceTimersByTime(700);
    expect(posts.filter((p) => p.classList.contains('entrou')).length).toBeGreaterThanOrEqual(1);
    expect(posts.filter((p) => p.classList.contains('entrou')).length).toBeLessThan(4);
    // o banco redesenha no meio: a revelação não recomeça
    t.renderizar(lugar(estadoTee({ ativa: pronta() })), false, AGORA + 700);
    expect($$('.tee-post')[0]).toBe(posts[0]);
    vi.advanceTimersByTime(6000);
    expect(posts.every((p) => p.classList.contains('entrou'))).toBe(true);
    expect($('.tee-pct').textContent).toBe('167%');
    expect($('.tee-selo').textContent).toBe('Combinação ótima!');
    expect($('.tee-resultado').textContent).toContain('Esgota');
    expect(localStorage.getItem(CHAVE_REVELADA)).toBeNull();
    $<HTMLButtonElement>('.tee-ver-venda').click();
    expect(localStorage.getItem(CHAVE_REVELADA)).toBe('41');
    expect(t.elemento.dataset.estado).toBe('venda');
  });
  it('sem localStorage (bloqueado): revela uma vez e não volta em loop', () => {
    const ler = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const gravar = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const { t, $ } = montar();
    t.renderizar(lugar(estadoTee({ ativa: pronta({ id: 77 }) })), false, AGORA);
    expect(t.elemento.dataset.estado).toBe('revelacao');
    $<HTMLButtonElement>('.tee-ver-venda').click();
    expect(t.elemento.dataset.estado).toBe('venda');
    t.renderizar(lugar(estadoTee({ ativa: pronta({ id: 77 }) })), false, AGORA + 60_000);
    expect(t.elemento.dataset.estado).toBe('venda');
    ler.mockRestore();
    gravar.mockRestore();
  });
  it('já viu: vai direto pra venda', () => {
    localStorage.setItem(CHAVE_REVELADA, '41');
    const { t } = montar();
    t.renderizar(lugar(estadoTee({ ativa: pronta() })), false, AGORA);
    expect(t.elemento.dataset.estado).toBe('venda');
  });
});

describe('venda', () => {
  beforeEach(() => localStorage.setItem(CHAVE_REVELADA, '41'));
  it('barra vendido/estoque, cupons entrando e o tempo que falta', () => {
    const { t, $ } = montar();
    t.renderizar(lugar(estadoTee({ ativa: pronta() })), false, AGORA);
    const barra = $('.tee-barra');
    expect(barra.getAttribute('aria-valuemax')).toBe('36');
    const antes = Number(barra.getAttribute('aria-valuenow'));
    expect(antes).toBeGreaterThan(0);
    expect($('.tee-vendidas').textContent).toMatch(/^\d+ de 36 vendidas$/);
    expect($('.tee-cupons').textContent).toMatch(/^\+\d+ cupons até agora$/);
    expect($('.tee-acaba').textContent).toBe('Acaba em 11 h');
    expect($('.tee-pct').textContent).toBe('167%');
    vi.advanceTimersByTime(2 * H);
    expect(Number($('.tee-barra').getAttribute('aria-valuenow'))).toBeGreaterThan(antes);
    expect($('.tee-acaba').textContent).toBe('Acaba em 9 h');
  });
  it('encalhe: diz quantas vão sobrar', () => {
    const { t, $ } = montar();
    t.renderizar(lugar(estadoTee({ ativa: pronta({ procura: 20, pct: 55 }) })), false, AGORA);
    expect($('.tee-previsao').textContent).toBe('Vão sobrar 16 peças');
  });
  it('Encerrar (saldão) confirma dentro da tela: Deixa quieto volta; Encerrar agora chama', () => {
    const confirmar = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmar);
    const { t, $ } = montar();
    t.renderizar(lugar(estadoTee({ ativa: pronta() })), false, AGORA);
    $<HTMLButtonElement>('.tee-encerrar').click();
    expect($('.tee-confirma').textContent).toContain('volta 49 cupons'); // metade do custo (3 cupons a peça) das 33 que sobraram
    $<HTMLButtonElement>('.tee-encerrar-nao').click();
    expect($('.tee-confirma')).toBeNull();
    $<HTMLButtonElement>('.tee-encerrar').click();
    $<HTMLButtonElement>('.tee-encerrar-sim').click();
    expect(acao).toHaveBeenCalledWith('idle_tee_encerrar', {});
    expect(confirmar).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('fim da venda: pede o lugar de novo (uma vez)', () => {
    const { t } = montar();
    t.renderizar(lugar(estadoTee({ ativa: pronta() })), false, AGORA);
    vi.advanceTimersByTime(11 * H + 2000);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });
});

describe('caderninho', () => {
  const notas: NotaCaderninho[] = [
    { tipo: 'combo', a: 2, b: 1, rotulo: 4 }, { tipo: 'combo', a: 1, b: 3, rotulo: 0 }, { tipo: 'peca', a: 1, b: 2, rotulo: 2 },
    { tipo: 'foco', a: 1, b: 0, rotulo: 352 },
  ];
  it('na faixa: o resumo em números e o botão que abre o caderninho inteiro no miolo', () => {
    const { mec, t } = montar();
    t.renderizar(lugar(estadoTee(), { caderninho: notas }), false, AGORA);
    const r = mec.caderninho(notas);
    document.body.append(r);
    expect(r.querySelector('.tee-resumo-num')!.textContent).toBe('2 de 18 combinações testadas');
    expect(r.querySelector('.tee-resumo-rot')!.textContent).toBe('1 ótima1 péssima');
    expect(r.querySelector('.tee-resumo-foco')!.textContent).toBe('Foco ideal: 1 de 2 estilos lançados');
    expect(r.querySelector('table')).toBeNull();
    r.querySelector<HTMLButtonElement>('.tee-abrir-caderno')!.click();
    expect(t.elemento.dataset.estado).toBe('caderno');
    expect(t.elemento.querySelector('.tee-tabela')).not.toBeNull();
    t.elemento.querySelector<HTMLButtonElement>('.tee-fechar-caderno')!.click();
    expect(t.elemento.dataset.estado).toBe('bancada');
  });
  const aberto = (extra: Partial<LugarEstado> = {}) => {
    const m = montar();
    m.t.renderizar(lugar(estadoTee(), { caderninho: notas, ...extra }), false, AGORA);
    m.mec.caderninho(notas).querySelector<HTMLButtonElement>('.tee-abrir-caderno')!.click();
    return m;
  };
  it('a tabela tema × estilo do que liberou, com a cor do rótulo nas testadas', () => {
    const { $, $$ } = aberto();
    expect($$('.tee-tabela tbody tr')).toHaveLength(6);
    expect($$('.tee-tabela thead th')).toHaveLength(4); // canto + 3 estilos
    expect($$('td.tee-c')).toHaveLength(18);
    expect($('td.rot-4').getAttribute('aria-label')).toBe('Praia com Minimalista: Combinação ótima!');
    expect($('td.rot-0').getAttribute('aria-label')).toBe('Meme com Pixel: Combinação péssima');
    expect($$('td.vazio')).toHaveLength(16);
    expect(caixinha('tee-cad-2-1')).toBe('Combinação ótima!');
  });
  it('focos descobertos e Relatório só dos estilos já lançados', () => {
    const { $, $$ } = aberto({ moeda: 80 });
    const linhas = $$('.tee-foco-item');
    expect(linhas).toHaveLength(2); // Minimalista e Pixel (lançados)
    expect(linhas[0].textContent).toBe('Minimalista3 · 5 · 2');
    expect(linhas[0].querySelector('.tee-foco-ideal')!.getAttribute('aria-label')).toBe('Arte 3 · Tecido 5 · Divulgação 2');
    expect($('.tee-focos .tee-rot').textContent).toContain('relatório: 50 cupons');
    const rel = $<HTMLButtonElement>('.tee-relatorio');
    expect(rel.textContent).toBe('Relatório');
    expect(rel.getAttribute('aria-label')).toBe('Comprar o relatório do Pixel por 50 cupons');
    expect(rel.disabled).toBe(false);
    rel.click();
    expect(acao).toHaveBeenCalledWith('idle_tee_relatorio', { p_estilo: 3 });
    expect(caixinha('tee-relatorio-3')).toBe('Mostra pra sempre o foco ideal do Pixel. Custa 50 cupons.');
  });
  it('sem cupom pro relatório: desabilitado; o caderninho aberto acompanha o banco', () => {
    const { t, $ } = aberto({ moeda: 10 });
    expect($<HTMLButtonElement>('.tee-relatorio').disabled).toBe(true);
    const mais = [...notas, { tipo: 'foco', a: 3, b: 0, rotulo: 622 }];
    t.renderizar(lugar(estadoTee(), { caderninho: mais, moeda: 0 }), false, AGORA);
    expect(t.elemento.dataset.estado).toBe('caderno');
    expect($('.tee-relatorio')).toBeNull();
    expect(t.elemento.textContent).toContain('Pixel6 · 2 · 2');
  });
});

describe('a mecânica registrada', () => {
  it('MECANICAS[3] é a camisetaria: libera, foto 48×48', () => {
    const m = MECANICAS[3]!;
    expect(m.libera(2)).toEqual(['Tema: Signo', 'Estilo: Grafite']);
    expect(m.libera(1)).toEqual([]);
    const f = m.foto([2, 4, 1, 3]);
    expect([f.width, f.height]).toEqual([48, 48]);
    expect(m.foto([1]).width).toBe(48); // partes quebradas: foto vazia, sem quebrar a moldura
  });
  it('lote médio no nível do lugar vem do catálogo', () => {
    expect(pecasLote(1, 1)).toBe(36);
  });
});
