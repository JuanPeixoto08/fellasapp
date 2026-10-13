// A camisetaria (lugar 3 do Mapa do rolê) na tela, no estilo de rua: a parede da bancada com a camiseta montada ao vivo e
// o nome colado como lambe-lambe. Quatro estados:
// * bancada (sem coleção rodando): tema, estilo, peça, cor, foco (10 pontos), lote, nome e "Lançar";
// * produção: a contagem até ficar pronta (chegando a hora, pede o lugar de novo pra revelar);
// * revelação (uma vez por coleção, guardada em localStorage): os 4 posts entrando, a % de procura subindo e o rótulo;
// * venda: a barra vendido/estoque, os cupons entrando e o "Encerrar (saldão)" com a confirmação aqui dentro.
// O caderninho (a faixa da moldura) mostra a tabela tema × estilo, os focos descobertos e o Relatório. Quem decide é o
// banco (idle_tee_*); aqui só mostra e chama.
import { button, el } from '../shared/hud/hud';
import type { LugarEstado, NotaCaderninho } from '../shared/types';
import { ativos } from './ativos';
import {
  caderno, comentario, CORES, custoLote, ESTILOS, gostou, INFLUENCERS, liberado, liberaTextos, NOME_ROTULO, nomeSugerido, PECAS,
  pecasLote, podeFiar, precoPeca, producaoMs, repeticao, TEMAS, vendidoAte, type Caderno, type ColecaoTee, type EstadoTee,
} from './camisetaria';
import { avatar, canvasDe, estampa, fotoImagem, fundoBancada, LADO_FOTO, pecaComCor } from './camisetariaArte';
import { dicaTeeCor, dicaTeeEstilo, dicaTeeFoco, dicaTeeLote, dicaTeePeca, dicaTeeRelatorio, dicaTeeTema, dicaTeeTrancados } from './dica';
import { criarFoco } from './foco';
import { formatarValor } from './formatar';
import type { AcoesMecanica, Dicas, Mecanica, TelaMecanica } from './mecanicas';

/** A última coleção que a pessoa já viu revelar (id). A revelação passa uma vez por coleção. */
export const CHAVE_REVELADA = 'fellas:tee-revelada';

type Tipo = 'tema' | 'estilo' | 'peca' | 'cor';
type Estado = 'carregando' | 'bancada' | 'producao' | 'revelacao' | 'venda' | 'caderno';
type Atual = { a: AcoesMecanica; dicas: Dicas; l: LugarEstado; m: EstadoTee; ocupado: boolean; abrirCaderno(): void };

const NOMES_FOCO = ['Arte', 'Tecido', 'Divulgação'] as const;
const NOMES_LOTE = ['Pequeno', 'Médio', 'Grande'] as const;
const ROTULO_CURTO = ['péssima', 'ruim', 'ok', 'boa', 'ótima'] as const;
/** O estilo na cabeça da coluna do caderninho (a caixinha e o leitor de tela dizem o nome inteiro). */
const ABREV = ['Min', 'Rab', 'Pix', 'Gra', 'Vin', 'Est', 'Tie', 'Xil', 'Neo', 'Bor', 'Pop', 'Col', 'Aqu', 'Gót', 'Y2K'];
/** A revelação: um post a cada POST_MS, depois a % sobe em CONTA_MS e o rótulo carimba. */
const POST_MS = 650;
const CONTA_INICIO = 4 * POST_MS + 250;
const CONTA_MS = 1200;
const SELO_MS = CONTA_INICIO + CONTA_MS + 150;
/** O estilo que desenha o tema "puro" nas peças do tema (Pixel: o desenho com o contorno de adesivo). */
const ESTILO_DO_TEMA = 3;

const LISTAS: Record<Tipo, readonly { id: number; nome: string; nivel: number }[]> = { tema: TEMAS, estilo: ESTILOS, peca: PECAS, cor: CORES };

/** Cupom resumido como o F$ ("1,2 mil"), sem o "F$". */
const quantia = (n: number) => formatarValor(n).replace('F$ ', '');
const pontos = (n: number) => (n === 1 ? '1 ponto' : `${n} pontos`);

/** "45 min", "2 h", "1 h 12 min" (arredonda pra cima: nunca diz 0 antes da hora). */
function tempo(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

function pinta(c: HTMLCanvasElement, img: ImageData): void {
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')?.putImageData(img, 0, 0);
}

function lerRevelada(): number {
  try {
    return Number(localStorage.getItem(CHAVE_REVELADA) ?? 0);
  } catch {
    return 0;
  }
}
function gravarRevelada(id: number): void {
  try {
    localStorage.setItem(CHAVE_REVELADA, String(id));
  } catch {
    // sem localStorage (aba anônima): revela de novo na próxima, sem problema
  }
}
const movimentoReduzido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A parede da bancada como imagem de fundo (uma vez só; sem canvas, fica a cor do lugar). */
let paredeUrl: string | null | undefined;
function parede(): string | null {
  if (paredeUrl === undefined) {
    try {
      const u = canvasDe(fundoBancada()).toDataURL('image/png');
      paredeUrl = u.startsWith('data:image/png') && u.length > 30 ? u : null;
    } catch {
      paredeUrl = null;
    }
  }
  return paredeUrl;
}

const partesDe = (c: Pick<ColecaoTee, 'tema' | 'estilo' | 'peca' | 'cor'>) => [c.tema, c.estilo, c.peca, c.cor];

/** A parede com a camiseta e o nome colado (lambe-lambe). */
function criarVitrine() {
  const raiz = el('div', 'tee-vitrine');
  const u = parede();
  if (u) raiz.style.backgroundImage = `url(${u})`;
  const foto = el('canvas', 'tee-foto');
  foto.setAttribute('role', 'img');
  const tag = el('p', 'tee-lambe');
  raiz.append(foto, tag);
  return {
    raiz,
    mostrar(partes: number[], nome: string, descricao: string) {
      pinta(foto, fotoImagem(partes));
      foto.setAttribute('aria-label', descricao);
      tag.textContent = nome;
    },
  };
}
const descrever = (partes: number[]) =>
  `${PECAS[partes[2] - 1].nome} ${CORES[partes[3] - 1].nome.toLowerCase()} com estampa de ${TEMAS[partes[0] - 1].nome} em ${ESTILOS[partes[1] - 1].nome}`;

/** O pedaço da barra (vendido/estoque ou produção) com o progressbar pra quem usa leitor de tela. */
function criarBarra(rotulo: string) {
  const b = el('div', 'tee-barra');
  b.setAttribute('role', 'progressbar');
  b.setAttribute('aria-label', rotulo);
  b.setAttribute('aria-valuemin', '0');
  const i = el('i');
  b.append(i);
  return {
    el: b,
    valor(v: number, max: number) {
      b.setAttribute('aria-valuemax', String(max));
      b.setAttribute('aria-valuenow', String(Math.floor(v)));
      i.style.width = `${Math.max(0, Math.min(1, max > 0 ? v / max : 0)) * 100}%`;
    },
  };
}

function previsao(c: ColecaoTee): string {
  const procura = c.procura ?? 0;
  if (procura >= c.pecas) return procura - c.pecas >= 1 ? `Esgota, e ainda sobra procura pra ${quantia(procura - c.pecas)} peças` : 'Esgota';
  return `Vão sobrar ${quantia(Math.ceil(c.pecas - procura))} peças`;
}
const PECA_TEMA = { 1: 'A peça combinou com o tema.', 0: 'A peça nem ajudou nem atrapalhou.', [-1]: 'A peça não combinou com o tema.' } as Record<number, string>;

function criarTela(a: AcoesMecanica, dicas: Dicas, avisar: (x: Atual) => void): TelaMecanica {
  const raiz = el('div', 'tee');
  raiz.dataset.estado = 'carregando';
  const foco = criarFoco(raiz);
  const sel = { tema: 1, estilo: 1, peca: 1, cor: 1, foco: [4, 3, 3] as [number, number, number], lote: 1 as 0 | 1 | 2, n: 0 };
  let ultimo: { l: LugarEstado; m: EstadoTee; ocupado: boolean } | null = null;
  let relogio = 0; // agora do servidor − Date.now()
  const agora = () => Date.now() + relogio;
  let estado: Estado = 'carregando';
  let revelando: number | null = null;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let tick: (() => void) | null = null;
  let intervalo: ReturnType<typeof setInterval> | null = null;
  const pedidos = new Set<string>();
  let confirmando = false;

  const pedir = (k: string) => {
    if (pedidos.has(k)) return;
    pedidos.add(k);
    a.recarregar?.();
  };
  const limparTimers = () => {
    for (const t of timers) clearTimeout(t);
    timers = [];
  };
  function garantirIntervalo() {
    if (intervalo) return;
    intervalo = setInterval(() => {
      if (!raiz.isConnected) {
        if (intervalo) clearInterval(intervalo);
        intervalo = null;
        return;
      }
      tick?.();
    }, 1000);
  }

  // ===================== bancada =====================
  // O campo do nome é um só (não sai do lugar entre um desenho e outro: o cursor e o que foi digitado ficam).
  const nome = el('input', 'tee-nome');
  nome.type = 'text';
  nome.maxLength = 30;
  nome.autocomplete = 'off';
  nome.spellcheck = false;
  nome.dataset.foco = 'tee-nome';
  nome.setAttribute('aria-label', 'Nome da coleção');
  nome.addEventListener('input', () => atualizarBancada());
  nome.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !lancar.disabled) lancar.click();
  });
  const sortear = button('Sortear', 'btn compacto tee-sortear', () => {
    sel.n++;
    nome.value = nomeSugerido(sel.tema, sel.estilo, sel.n);
    atualizarBancada();
  });
  sortear.dataset.foco = 'tee-sortear';
  const lancar = button('', 'btn main tee-lancar', () => {
    if (!ultimo) return;
    a.acao('idle_tee_lancar', {
      p_tema: sel.tema, p_estilo: sel.estilo, p_peca: sel.peca, p_cor: sel.cor,
      p_arte: sel.foco[0], p_tecido: sel.foco[1], p_div: sel.foco[2], p_lote: sel.lote, p_nome: nome.value.trim() || nome.placeholder,
    });
  });
  lancar.dataset.foco = 'tee-lancar';
  const aviso = el('p', 'tee-aviso');
  aviso.setAttribute('aria-live', 'polite');

  type Bancada = {
    el: HTMLElement; nivel: number; vitrine: ReturnType<typeof criarVitrine>;
    botoes: Record<Tipo, HTMLButtonElement[]>; artes: Partial<Record<Tipo, (HTMLCanvasElement | null)[]>>;
    nomes: Record<Tipo, HTMLElement>; focoValores: HTMLElement[]; pips: HTMLElement[][]; mais: HTMLButtonElement[]; menos: HTMLButtonElement[];
    focoSobra: HTMLElement; lotes: HTMLButtonElement[]; temaArte: number; corArte: number;
  };
  let bancada: Bancada | null = null;

  const cadAtual = (): Caderno => caderno(ultimo?.l.caderninho ?? []);
  const nivelAtual = () => ultimo?.l.nivel ?? 1;

  function escolher(tipo: Tipo, id: number) {
    if (!liberado(tipo, id, nivelAtual())) return;
    sel[tipo] = id;
    atualizarBancada();
  }

  /** Setas andam no grupo (um item só no Tab, como rádio); o que liberou já fica escolhido. */
  function setas(e: KeyboardEvent, tipo: Tipo, id: number) {
    const passo = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
    const lista = bancada?.botoes[tipo];
    if (!passo || !lista) return;
    e.preventDefault();
    const i = (id - 1 + passo + lista.length) % lista.length;
    lista[i].focus();
    escolher(tipo, i + 1);
  }

  function cadeado(): HTMLElement {
    const c = el('i', 'pino-cadeado');
    const url = ativos.estudio('cadeado');
    if (url) c.style.backgroundImage = `url(${url})`;
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  function grade(tipo: Tipo, rotulo: string, nivel: number, b: Bancada, tendencia: number): HTMLElement {
    const g = el('div', `tee-grade tee-grade-${tipo}`);
    g.setAttribute('role', 'radiogroup');
    g.setAttribute('aria-label', rotulo);
    b.botoes[tipo] = [];
    const artes: (HTMLCanvasElement | null)[] = [];
    // só o que já liberou vira ladrilho (liberam em ordem: os liberados são sempre os primeiros); o resto é um cadeado só
    const trancados = LISTAS[tipo].filter((item) => !liberado(tipo, item.id, nivel));
    for (const item of LISTAS[tipo].filter((x) => liberado(tipo, x.id, nivel))) {
      const bt = el('button', `tee-item tee-${tipo}`);
      bt.type = 'button';
      bt.setAttribute('role', 'radio');
      bt.dataset.foco = `tee-${tipo}-${item.id}`;
      let arte: HTMLCanvasElement | null = null;
      if (tipo === 'cor') {
        const amostra = el('span', 'tee-amostra');
        amostra.style.setProperty('--cor', CORES[item.id - 1].hex);
        bt.append(amostra);
        bt.setAttribute('aria-label', item.nome);
      } else {
        arte = el('canvas', 'tee-arte');
        arte.setAttribute('aria-hidden', 'true');
        if (tipo === 'tema') pinta(arte, estampa(item.id, ESTILO_DO_TEMA));
        bt.append(arte);
        const alta = tipo === 'tema' && item.id === tendencia;
        if (alta) bt.append(el('span', 'tee-alta', 'alta'));
        bt.setAttribute('aria-label', alta ? `${item.nome}, em alta` : item.nome);
      }
      artes.push(arte);
      bt.addEventListener('click', () => escolher(tipo, item.id));
      bt.addEventListener('keydown', (e) => setas(e, tipo, item.id));
      dicas.ligar(bt, `tee-${tipo}-${item.id}`, item.nome, () => {
        const n = nivelAtual();
        const cad = cadAtual();
        if (tipo === 'tema') return dicaTeeTema(item.id, sel.estilo, n, cad, ultimo?.m.tendencia ?? 0);
        if (tipo === 'estilo') return dicaTeeEstilo(item.id, sel.tema, n, cad);
        if (tipo === 'peca') return dicaTeePeca(item.id, sel.tema, n, cad);
        return dicaTeeCor(item.id, n);
      });
      b.botoes[tipo].push(bt);
      g.append(bt);
    }
    b.artes[tipo] = artes;
    if (trancados.length) {
      // o cadeado com quantos faltam; a caixinha diz o próximo e em que nível
      const t = el('span', `tee-item tee-trancados tee-trancados-${tipo}`);
      t.tabIndex = 0;
      t.dataset.foco = `tee-${tipo}-trancados`;
      const texto = dicaTeeTrancados(tipo, nivel);
      t.setAttribute('role', 'note');
      t.setAttribute('aria-label', texto);
      t.append(cadeado(), el('span', 'tee-niv', `+${trancados.length}`));
      dicas.ligar(t, `tee-${tipo}-trancados`, 'Trancado', () => dicaTeeTrancados(tipo, nivelAtual()));
      g.append(t);
    }
    return g;
  }

  function secao(cls: string, titulo: string, escolhido?: HTMLElement): HTMLElement {
    const s = el('section', `tee-secao ${cls}`);
    const h = el('h4', 'tee-rot');
    h.append(el('span', undefined, titulo));
    if (escolhido) h.append(escolhido);
    s.append(h);
    return s;
  }

  function montarBancada(nivel: number, tendencia: number): Bancada {
    const b = {
      el: el('div', 'tee-bancada'), nivel, vitrine: criarVitrine(), botoes: {}, artes: {}, nomes: {}, focoValores: [], pips: [], mais: [], menos: [],
      focoSobra: el('span', 'tee-sobra'), lotes: [], temaArte: 0, corArte: 0,
    } as unknown as Bancada;
    for (const t of ['tema', 'estilo', 'peca', 'cor'] as const) b.nomes[t] = el('span', `tee-sel tee-sel-${t}`);

    // à esquerda: a parede com a prévia, o nome, o foco e o Lançar
    const lado = el('div', 'tee-lado');
    const linhaNome = el('div', 'tee-linha-nome');
    linhaNome.append(nome, sortear);

    const focoS = secao('tee-foco', 'Foco', b.focoSobra);
    dicas.ligar(focoS, 'tee-foco', 'Foco', () => dicaTeeFoco(sel.estilo, cadAtual()));
    NOMES_FOCO.forEach((rot, k) => {
      const linha = el('div', 'tee-foco-linha');
      const pips = el('span', 'tee-pips');
      pips.setAttribute('aria-hidden', 'true');
      const is = Array.from({ length: 10 }, () => el('i'));
      pips.append(...is);
      const valor = el('b', 'tee-foco-valor');
      const menos = button('−', 'btn tee-passo tee-foco-menos', () => mudarFoco(k, -1));
      const mais = button('+', 'btn tee-passo tee-foco-mais', () => mudarFoco(k, 1));
      menos.setAttribute('aria-label', `Menos ${rot}`);
      mais.setAttribute('aria-label', `Mais ${rot}`);
      menos.dataset.foco = `tee-foco-${k}-menos`;
      mais.dataset.foco = `tee-foco-${k}-mais`;
      linha.append(el('span', 'tee-foco-nome', rot), pips, menos, valor, mais);
      focoS.append(linha);
      b.focoValores.push(valor);
      b.pips.push(is);
      b.mais.push(mais);
      b.menos.push(menos);
    });
    const fim = el('div', 'tee-fim');
    fim.append(lancar, aviso);
    lado.append(b.vitrine.raiz, linhaNome, focoS, fim);

    // à direita: as escolhas
    const escolhas = el('div', 'tee-escolhas');
    const sTema = secao('tee-s-tema', 'Tema', b.nomes.tema);
    sTema.append(grade('tema', 'Tema', nivel, b, tendencia));
    const sEstilo = secao('tee-s-estilo', 'Estilo', b.nomes.estilo);
    sEstilo.append(grade('estilo', 'Estilo', nivel, b, tendencia));
    const sPeca = secao('tee-s-peca', 'Peça', b.nomes.peca);
    sPeca.append(grade('peca', 'Peça', nivel, b, tendencia));
    const sCor = secao('tee-s-cor', 'Cor', b.nomes.cor);
    sCor.append(grade('cor', 'Cor', nivel, b, tendencia));
    const pecaCor = el('div', 'tee-peca-cor');
    pecaCor.append(sPeca, sCor);
    const sLote = secao('tee-s-lote', 'Lote');
    const lotes = el('div', 'tee-lotes');
    lotes.setAttribute('role', 'radiogroup');
    lotes.setAttribute('aria-label', 'Lote');
    ([0, 1, 2] as const).forEach((k) => {
      const bt = el('button', 'tee-lote');
      bt.type = 'button';
      bt.setAttribute('role', 'radio');
      bt.dataset.foco = `tee-lote-${k}`;
      bt.addEventListener('click', () => {
        sel.lote = k;
        atualizarBancada();
      });
      bt.addEventListener('keydown', (e) => {
        const passo = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
        if (!passo) return;
        e.preventDefault();
        sel.lote = ((k + passo + 3) % 3) as 0 | 1 | 2;
        b.lotes[sel.lote].focus();
        atualizarBancada();
      });
      dicas.ligar(bt, `tee-lote-${k}`, `Lote ${NOMES_LOTE[k].toLowerCase()}`, () => dicaTeeLote(sel.peca, nivelAtual(), k));
      b.lotes.push(bt);
      lotes.append(bt);
    });
    sLote.append(lotes);
    escolhas.append(sTema, sEstilo, pecaCor, sLote);

    b.el.append(lado, escolhas);
    return b;
  }

  function mudarFoco(k: number, d: number) {
    const soma = sel.foco[0] + sel.foco[1] + sel.foco[2];
    const v = sel.foco[k] + d;
    if (v < 0 || v > 10 || (d > 0 && soma >= 10)) return;
    sel.foco[k] = v;
    atualizarBancada();
  }

  function atualizarBancada() {
    const b = bancada;
    if (!b || !ultimo) return;
    const { l, m, ocupado } = ultimo;
    const nivel = l.nivel ?? 1;
    const moeda = l.moeda ?? 0;
    for (const tipo of ['tema', 'estilo', 'peca', 'cor'] as const) {
      b.botoes[tipo].forEach((bt, i) => {
        const on = sel[tipo] === i + 1;
        bt.setAttribute('aria-checked', String(on));
        bt.tabIndex = on ? 0 : -1;
      });
      b.nomes[tipo].textContent = LISTAS[tipo][sel[tipo] - 1].nome;
    }
    // a arte dos estilos é o tema escolhido em cada estilo; a das peças, a cor escolhida
    if (b.temaArte !== sel.tema) {
      b.temaArte = sel.tema;
      b.artes.estilo?.forEach((c, i) => c && pinta(c, estampa(sel.tema, i + 1)));
    }
    if (b.corArte !== sel.cor) {
      b.corArte = sel.cor;
      b.artes.peca?.forEach((c, i) => c && pinta(c, pecaComCor(i + 1, CORES[sel.cor - 1].hex)));
    }
    // foco
    const soma = sel.foco[0] + sel.foco[1] + sel.foco[2];
    b.focoSobra.textContent = soma === 10 ? '10 de 10' : `${soma} de 10`;
    b.focoSobra.classList.toggle('falta', soma !== 10);
    sel.foco.forEach((v, k) => {
      b.focoValores[k].textContent = String(v);
      b.pips[k].forEach((p, i) => p.classList.toggle('cheio', i < v));
      b.mais[k].disabled = soma >= 10 || v >= 10;
      b.menos[k].disabled = v <= 0;
    });
    // lotes: peças, custo e tempo da peça escolhida
    b.lotes.forEach((bt, k) => {
      const on = sel.lote === k;
      bt.setAttribute('aria-checked', String(on));
      bt.tabIndex = on ? 0 : -1;
      const custo = custoLote(sel.peca, nivel, k as 0 | 1 | 2);
      bt.replaceChildren(el('strong', undefined, NOMES_LOTE[k]), el('span', 'tee-lote-pecas', `${quantia(pecasLote(nivel, k as 0 | 1 | 2))} peças`),
        el('span', 'tee-lote-custo', `${quantia(custo)} cupons · ${producaoMs(k as 0 | 1 | 2) / 3600_000} h`));
      bt.classList.toggle('caro', moeda < custo);
    });
    // nome e a prévia ao vivo
    nome.placeholder = nomeSugerido(sel.tema, sel.estilo, sel.n);
    const partes = [sel.tema, sel.estilo, sel.peca, sel.cor];
    b.vitrine.mostrar(partes, nome.value.trim() || nome.placeholder, `Prévia: ${descrever(partes)}`);
    // Lançar
    const custo = custoLote(sel.peca, nivel, sel.lote);
    const ultimoFiado = m.ultimo_fiado ? Date.parse(m.ultimo_fiado) : null;
    const fia = podeFiar(true, moeda, custoLote(sel.peca, nivel, 0), ultimoFiado, agora());
    const avisos: string[] = [];
    let pode = !ocupado && soma === 10;
    if (soma < 10) avisos.push(`Sobra ${pontos(10 - soma)} no foco.`);
    if (moeda >= custo) lancar.textContent = `Lançar por ${quantia(custo)} cupons`;
    else if (sel.lote === 0 && fia) {
      lancar.textContent = 'Lançar fiado';
      avisos.push('Sem cupom: o fornecedor fia esse lote (1 vez por dia).');
    } else {
      pode = false;
      lancar.textContent = `Lançar por ${quantia(custo)} cupons`;
      avisos.push(`Faltam ${quantia(Math.ceil(custo - moeda))} cupons.`);
      if (fia) avisos.push('Sem cupom: o lote pequeno sai fiado (1 vez por dia).');
    }
    const rep = repeticao(sel.tema, sel.estilo, m.historico);
    if (rep === 2) avisos.push('Mesmo tema e estilo de uma das 3 últimas: a nota cai.');
    else if (rep === 1) avisos.push('Mesmo tema ou estilo da última coleção: a nota cai um pouco.');
    if (!avisos.length) avisos.push(`Fica pronta em ${producaoMs(sel.lote) / 3600_000} h e vende por 12 h.`);
    aviso.textContent = avisos.join(' ');
    aviso.classList.toggle('alerta', !pode && !ocupado);
    lancar.disabled = !pode;
    sortear.disabled = ocupado;
  }

  function desenharBancada(l: LugarEstado, m: EstadoTee) {
    const nivel = l.nivel ?? 1;
    if (!bancada || bancada.nivel !== nivel) bancada = montarBancada(nivel, m.tendencia);
    for (const t of ['tema', 'estilo', 'peca', 'cor'] as const) if (!liberado(t, sel[t], nivel)) sel[t] = 1;
    if (raiz.firstChild !== bancada.el || raiz.childNodes.length !== 1) raiz.replaceChildren(bancada.el);
    tick = null;
    atualizarBancada();
  }

  // ===================== produção =====================
  function ficha(c: ColecaoTee): HTMLElement {
    const dl = el('dl', 'tee-ficha');
    for (const [k, v] of [
      ['Tema', TEMAS[c.tema - 1].nome], ['Estilo', ESTILOS[c.estilo - 1].nome], ['Peça', PECAS[c.peca - 1].nome], ['Cor', CORES[c.cor - 1].nome],
      ['Foco', `Arte ${c.arte} · Tecido ${c.tecido} · Divulgação ${c.div}`],
      ['Lote', `${NOMES_LOTE[c.lote]} · ${quantia(c.pecas)} peças${c.fiado ? ' · fiado' : ''}`],
    ] as const) dl.append(el('dt', undefined, k), el('dd', undefined, v));
    return dl;
  }

  function desenharProducao(c: ColecaoTee) {
    const s = el('div', 'tee-palco tee-producao');
    const v = criarVitrine();
    v.mostrar(partesDe(c), c.nome, descrever(partesDe(c)));
    const painel = el('div', 'tee-painel');
    const conta = el('b', 'tee-conta');
    const falta = el('p', 'tee-falta');
    falta.append('Fica pronta em ', conta);
    const barra = criarBarra('Produção');
    painel.append(el('h3', 'tee-titulo', 'Na produção'), falta, barra.el, ficha(c),
      el('p', 'sub tee-dica', 'Quando ficar pronta, 4 influencers postam o que acharam. Ninguém tá preparado.'));
    s.append(v.raiz, painel);
    raiz.replaceChildren(s);
    const inicio = Date.parse(c.criada_em);
    const fimMs = Date.parse(c.pronta_em);
    tick = () => {
      const t = agora();
      const resta = fimMs - t;
      barra.valor(Math.round(((t - inicio) / Math.max(1, fimMs - inicio)) * 100), 100);
      if (resta > 0) conta.textContent = tempo(resta);
      else {
        falta.textContent = 'Pronta! Chamando os influencers…';
        pedir(`${c.id}:pronta`);
      }
    };
    tick();
  }

  // ===================== revelação =====================
  function desenharRevelacao(c: ColecaoTee) {
    revelando = c.id;
    const ns = c.notas ?? [];
    const s = el('div', 'tee-revelacao');
    const topo = el('header', 'tee-rev-topo');
    const mini = canvasDe(fotoImagem(partesDe(c)));
    mini.className = 'tee-rev-foto';
    mini.setAttribute('aria-hidden', 'true');
    const tit = el('div', 'tee-rev-tit');
    tit.append(el('h3', 'tee-titulo', c.nome), el('p', 'sub', 'Ficou pronta. Os influencers postaram:'));
    topo.append(mini, tit);

    const posts = el('ol', 'tee-posts');
    const lis = INFLUENCERS.map((inf, k) => {
      const nota = ns[k] ?? 0;
      const li = el('li', `tee-post ${nota >= 8 ? 'alta' : nota >= 5 ? 'media' : 'baixa'}`);
      const av = canvasDe(avatar(inf.id));
      av.className = 'tee-avatar';
      av.setAttribute('aria-hidden', 'true');
      const meio = el('div', 'tee-post-meio');
      meio.append(el('span', 'tee-handle', inf.nome), el('p', 'tee-comentario', comentario(k, nota, gostou(k, c), c.tema)));
      const n = el('b', 'tee-nota', String(nota));
      n.setAttribute('aria-label', `nota ${nota}`);
      li.append(av, meio, n);
      posts.append(li);
      return li;
    });

    const res = el('div', 'tee-resultado');
    const pct = el('b', 'tee-pct', '0%');
    const linhaPct = el('p', 'tee-linha-pct');
    linhaPct.append(pct, el('span', undefined, 'de procura'));
    const selo = el('span', `tee-selo rot-${c.rotulo ?? 2}`, NOME_ROTULO[c.rotulo ?? 2]);
    const prev = el('p', 'tee-previsao', previsao(c));
    const peca = el('p', 'sub', PECA_TEMA[c.peca_tema ?? 0] ?? '');
    res.append(linhaPct, selo, prev, peca);
    const ver = button('Ver a venda', 'btn main tee-ver-venda', () => {
      gravarRevelada(c.id);
      revelando = null;
      const chave = foco.guardar();
      if (ultimo) desenhar(ultimo.l, ultimo.m);
      foco.devolver(chave === 'tee-ver-venda' ? 'tee-encerrar' : chave);
    });
    ver.dataset.foco = 'tee-ver-venda';
    s.append(topo, posts, res, ver);
    raiz.replaceChildren(s);
    tick = null;

    const alvo = Math.round(c.pct ?? 0);
    const final = () => {
      for (const li of lis) li.classList.add('entrou');
      pct.textContent = `${alvo}%`;
      res.classList.add('entrou');
      selo.classList.add('entrou');
    };
    if (movimentoReduzido()) {
      final();
      return;
    }
    lis.forEach((li, k) => timers.push(setTimeout(() => li.classList.add('entrou'), 120 + k * POST_MS)));
    timers.push(setTimeout(() => res.classList.add('entrou'), CONTA_INICIO));
    const passos = 24;
    for (let i = 1; i <= passos; i++) {
      const f = 1 - (1 - i / passos) ** 3; // sobe rápido e assenta
      timers.push(setTimeout(() => { pct.textContent = `${Math.round(alvo * f)}%`; }, CONTA_INICIO + (CONTA_MS * i) / passos));
    }
    timers.push(setTimeout(final, SELO_MS));
  }

  // ===================== venda =====================
  function desenharVenda(c: ColecaoTee, ocupado: boolean) {
    const s = el('div', 'tee-palco tee-venda');
    const v = criarVitrine();
    v.mostrar(partesDe(c), c.nome, descrever(partesDe(c)));
    const painel = el('div', 'tee-painel');
    const cab = el('div', 'tee-venda-cab');
    const acaba = el('span', 'tee-acaba');
    cab.append(el('h3', 'tee-titulo', 'À venda'), acaba);

    const notas = el('ul', 'tee-mini-notas');
    (c.notas ?? []).forEach((n, k) => {
      const li = el('li');
      const av = canvasDe(avatar(INFLUENCERS[k].id));
      av.className = 'tee-avatar';
      av.setAttribute('aria-hidden', 'true');
      li.append(av, el('b', undefined, String(n)));
      li.setAttribute('aria-label', `${INFLUENCERS[k].nome}: nota ${n}`);
      notas.append(li);
    });
    const linhaPct = el('p', 'tee-linha-pct');
    linhaPct.append(el('b', 'tee-pct', `${Math.round(c.pct ?? 0)}%`), el('span', undefined, 'de procura'),
      el('span', `tee-selo entrou rot-${c.rotulo ?? 2}`, NOME_ROTULO[c.rotulo ?? 2]));
    const barra = criarBarra('Vendidas');
    const vendidas = el('span', 'tee-vendidas');
    const cupons = el('span', 'tee-cupons');
    const numeros = el('p', 'tee-venda-num');
    numeros.append(vendidas, cupons);
    const acoes = el('div', 'tee-venda-acoes');
    painel.append(cab, notas, linhaPct, barra.el, numeros, el('p', 'tee-previsao', previsao(c)), acoes);
    s.append(v.raiz, painel);
    raiz.replaceChildren(s);

    const total = Math.min(c.procura ?? 0, c.pecas);
    const pronta = Date.parse(c.pronta_em);
    const fim = Date.parse(c.fim_em);
    const preco = precoPeca(c.peca);
    const vendidoAgora = () => vendidoAte(total, pronta, agora());
    const devolve = () => (c.fiado ? 0 : (0.5 * c.custo * (c.pecas - vendidoAgora())) / c.pecas);
    const textoConfirma = () => {
      const sobra = Math.max(0, Math.ceil(c.pecas - vendidoAgora()));
      return c.fiado ? `Encerrar agora? A venda para e as ${quantia(sobra)} peças que sobraram vão embora (o lote foi fiado: não volta cupom).`
        : `Encerrar agora? A venda para e volta ${quantia(devolve())} cupons (metade do custo das ${quantia(sobra)} peças que sobraram).`;
    };
    let pConfirma: HTMLElement | null = null;
    const montarAcoes = () => {
      pConfirma = null;
      if (!confirmando) {
        const enc = button('Encerrar (saldão)', 'btn tee-encerrar', () => {
          confirmando = true;
          montarAcoes();
          acoes.querySelector<HTMLButtonElement>('.tee-encerrar-nao')?.focus();
        });
        enc.dataset.foco = 'tee-encerrar';
        enc.disabled = ocupado;
        acoes.replaceChildren(enc);
        return;
      }
      const box = el('div', 'tee-confirma');
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Encerrar a venda');
      pConfirma = el('p', undefined, textoConfirma());
      const sim = button('Encerrar agora', 'btn tee-encerrar-sim', () => {
        confirmando = false;
        a.acao('idle_tee_encerrar', {});
      });
      const nao = button('Deixa quieto', 'btn main tee-encerrar-nao', () => {
        confirmando = false;
        montarAcoes();
        acoes.querySelector<HTMLButtonElement>('.tee-encerrar')?.focus();
      });
      sim.dataset.foco = 'tee-encerrar-sim';
      nao.dataset.foco = 'tee-encerrar-nao';
      sim.disabled = ocupado;
      const bts = el('div', 'tee-confirma-bts');
      bts.append(nao, sim);
      box.append(pConfirma, bts);
      acoes.replaceChildren(box);
    };
    montarAcoes();

    tick = () => {
      const vend = vendidoAgora();
      barra.valor(vend, c.pecas);
      vendidas.textContent = `${quantia(vend)} de ${quantia(c.pecas)} vendidas`;
      cupons.textContent = `+${quantia(vend * preco)} cupons até agora`;
      const resta = fim - agora();
      acaba.textContent = resta > 0 ? `Acaba em ${tempo(resta)}` : 'Acabou';
      if (pConfirma) pConfirma.textContent = textoConfirma();
      if (resta <= 0) pedir(`${c.id}:fim`);
    };
    tick();
  }

  // ===================== o desenho =====================
  // ===================== o caderninho inteiro (aberto pela faixa) =====================
  let vendoCaderno = false;
  const atualDe = (l: LugarEstado, m: EstadoTee, ocupado: boolean): Atual => ({ a, dicas, l, m, ocupado, abrirCaderno });
  function abrirCaderno() {
    if (!ultimo) return;
    vendoCaderno = true;
    desenhar(ultimo.l, ultimo.m);
    raiz.querySelector<HTMLButtonElement>('.tee-fechar-caderno')?.focus();
  }
  function fecharCaderno() {
    vendoCaderno = false;
    if (ultimo) desenhar(ultimo.l, ultimo.m);
    document.querySelector<HTMLElement>('[data-foco="tee-abrir-caderno"]')?.focus();
  }
  function desenharCaderno(l: LugarEstado, m: EstadoTee) {
    const s = el('div', 'tee-caderno');
    const cab = el('header', 'tee-caderno-cab');
    const tit = el('div', 'tee-caderno-tit');
    tit.append(el('h3', 'tee-titulo', 'Caderninho'),
      el('p', 'sub', 'O que os influencers acharam de cada tema com cada estilo que você lançou, e o foco ideal que o relatório contou.'));
    const voltar = button(estado === 'bancada' ? 'Voltar pra bancada' : 'Voltar', 'btn tee-fechar-caderno', fecharCaderno);
    voltar.dataset.foco = 'tee-fechar-caderno';
    cab.append(tit, voltar);
    s.append(cab, criarCadernoCompleto(l.caderninho, atualDe(l, m, ultimo?.ocupado ?? false)));
    raiz.replaceChildren(s);
  }

  function desenhar(l: LugarEstado, m: EstadoTee) {
    const c = m.ativa;
    const novo: Estado = !c ? 'bancada' : !c.pronta || !c.notas ? 'producao'
      : revelando === c.id || lerRevelada() !== c.id ? 'revelacao' : 'venda';
    if (!vendoCaderno && novo === 'revelacao' && estado === 'revelacao' && revelando === c?.id) return; // a revelação que está passando não recomeça
    limparTimers();
    if (estado === 'bancada' && novo !== 'bancada') {
      // lançou: o próximo nome começa do zero
      nome.value = '';
      sel.n++;
    }
    if (vendoCaderno) {
      revelando = null; // a revelação (se tinha) passa de novo quando voltar
      estado = novo;
      raiz.dataset.estado = 'caderno';
      desenharCaderno(l, m);
      tick = null;
      return;
    }
    if (novo !== 'venda') confirmando = false;
    if (novo !== 'revelacao') revelando = null;
    estado = novo;
    raiz.dataset.estado = novo;
    if (novo === 'bancada') desenharBancada(l, m);
    else if (novo === 'producao') desenharProducao(c!);
    else if (novo === 'revelacao') desenharRevelacao(c!);
    else desenharVenda(c!, ultimo?.ocupado ?? false);
    garantirIntervalo();
  }

  function renderizar(l: LugarEstado, ocupado: boolean, agoraMs: number) {
    relogio = agoraMs - Date.now();
    const m = l.mecanica as EstadoTee | null;
    if (!m) {
      ultimo = null;
      estado = 'carregando';
      raiz.dataset.estado = estado;
      raiz.replaceChildren(el('p', 'vazio', 'Carregando a camisetaria…'));
      return;
    }
    ultimo = { l, m, ocupado };
    avisar(atualDe(l, m, ocupado));
    desenhar(l, m);
  }

  return { elemento: raiz, renderizar };
}

// ===================== caderninho =====================
/** Os estilos já lançados (o relatório só vale pra eles): os do caderninho, o da coleção rodando e os do histórico. */
function estilosLancados(cad: Caderno, atual: Atual | null): number[] {
  const s = new Set<number>([...cad.combos.keys()].map((k) => Number(k.split(',')[1])));
  if (atual?.m.ativa) s.add(atual.m.ativa.estilo);
  for (const h of atual?.m.historico ?? []) s.add(h.estilo);
  return [...s].sort((x, y) => x - y);
}

/** O caderninho inteiro (no miolo do lugar): a tabela tema × estilo do que liberou com a cor do rótulo, a legenda e o
 *  foco ideal de cada estilo lançado (ou o Relatório pra comprar). */
function criarCadernoCompleto(itens: readonly NotaCaderninho[], atual: Atual | null): HTMLElement {
  const cad = caderno(itens);
  const nivel = atual?.l.nivel ?? 1;
  const raiz = el('div', 'tee-cad');
  const temas = TEMAS.filter((t) => liberado('tema', t.id, nivel));
  const estilos = ESTILOS.filter((e) => liberado('estilo', e.id, nivel));

  const tabela = el('table', 'tee-tabela');
  tabela.setAttribute('aria-label', 'Combinações de tema e estilo');
  const cab = el('tr');
  const canto = el('th');
  canto.setAttribute('aria-label', 'Tema');
  cab.append(canto);
  for (const e of estilos) {
    const th = el('th', undefined, ABREV[e.id - 1]);
    th.scope = 'col';
    th.setAttribute('aria-label', e.nome);
    cab.append(th);
  }
  const thead = el('thead');
  thead.append(cab);
  const tbody = el('tbody');
  for (const t of temas) {
    const tr = el('tr');
    const th = el('th', undefined, t.nome);
    th.scope = 'row';
    tr.append(th);
    for (const e of estilos) {
      const r = cad.combos.get(`${t.id},${e.id}`);
      const td = el('td', `tee-c ${r === undefined ? 'vazio' : `rot-${r}`}`);
      const texto = r === undefined ? 'Ainda não testou.' : NOME_ROTULO[r];
      td.setAttribute('aria-label', `${t.nome} com ${e.nome}: ${r === undefined ? 'ainda não testou' : NOME_ROTULO[r]}`);
      atual?.dicas.ligar(td, `tee-cad-${t.id}-${e.id}`, `${t.nome} × ${e.nome}`, () => texto);
      tr.append(td);
    }
    tbody.append(tr);
  }
  tabela.append(thead, tbody);

  const lado = el('div', 'tee-cad-lado');
  const legenda = el('p', 'tee-legenda');
  legenda.setAttribute('aria-hidden', 'true');
  ROTULO_CURTO.forEach((r, k) => {
    const sp = el('span');
    sp.append(el('i', `rot-${k}`), r);
    legenda.append(sp);
  });
  legenda.append((() => { const sp = el('span'); sp.append(el('i', 'vazio'), 'não testou'); return sp; })());

  const lancados = estilosLancados(cad, atual);
  const focos = el('div', 'tee-focos');
  const precoRel = atual?.m.precos.relatorio ?? 0;
  const tituloFocos = el('h4', 'tee-rot');
  tituloFocos.append(el('span', undefined, 'Foco ideal (arte · tecido · divulgação)'));
  if (lancados.some((id) => !cad.focos.has(id))) tituloFocos.append(el('span', 'tee-rel-preco', `relatório: ${quantia(Math.ceil(precoRel))} cupons`));
  focos.append(tituloFocos);
  if (!lancados.length) focos.append(el('p', 'sub', 'Lança uma coleção pra poder comprar o relatório do estilo dela.'));
  else {
    const ul = el('ul', 'tee-focos-lista');
    for (const id of lancados) {
      const li = el('li', 'tee-foco-item');
      li.append(el('span', 'tee-foco-estilo', ESTILOS[id - 1].nome));
      const f = cad.focos.get(id);
      if (f) {
        const ideal = el('span', 'tee-foco-ideal', `${f[0]} · ${f[1]} · ${f[2]}`);
        ideal.setAttribute('aria-label', `Arte ${f[0]} · Tecido ${f[1]} · Divulgação ${f[2]}`);
        li.append(ideal);
      } else {
        const preco = precoRel;
        const moeda = atual?.l.moeda ?? 0;
        const bt = button('Relatório', 'btn compacto tee-relatorio', () => atual?.a.acao('idle_tee_relatorio', { p_estilo: id }));
        bt.dataset.foco = `tee-relatorio-${id}`;
        bt.setAttribute('aria-label', `Comprar o relatório do ${ESTILOS[id - 1].nome} por ${quantia(Math.ceil(preco))} cupons`);
        bt.disabled = !atual || atual.ocupado || moeda < preco;
        atual?.dicas.ligar(bt, `tee-relatorio-${id}`, `Relatório: ${ESTILOS[id - 1].nome}`, () => dicaTeeRelatorio(id, preco, atual?.l.moeda ?? 0));
        li.append(bt);
      }
      ul.append(li);
    }
    focos.append(ul);
  }
  lado.append(legenda, focos);
  raiz.append(tabela, lado);
  return raiz;
}

/** O caderninho na faixa da moldura: o resumo em números e o botão que abre o caderninho inteiro no miolo. */
function criarResumoCaderninho(itens: readonly NotaCaderninho[], atual: (Atual & { abrirCaderno(): void }) | null): HTMLElement {
  const cad = caderno(itens);
  const nivel = atual?.l.nivel ?? 1;
  const total = TEMAS.filter((t) => liberado('tema', t.id, nivel)).length * ESTILOS.filter((e) => liberado('estilo', e.id, nivel)).length;
  // só o que liberou (o caderninho e a tabela falam da mesma coisa)
  const rotulos = [...cad.combos.entries()].filter(([k]) => {
    const [t, e] = k.split(',').map(Number);
    return liberado('tema', t, nivel) && liberado('estilo', e, nivel);
  }).map(([, r]) => r);
  const testadas = rotulos.length;
  const raiz = el('div', 'tee-cad-resumo');
  const linha = el('p', 'tee-resumo-num');
  linha.append(el('b', undefined, String(testadas)), ` de ${total} combinações testadas`);
  const contas = el('p', 'tee-resumo-rot');
  for (let r = 4; r >= 0; r--) {
    const n = rotulos.filter((x) => x === r).length;
    if (!n) continue;
    const sp = el('span');
    sp.append(el('i', `rot-${r}`), `${n} ${ROTULO_CURTO[r]}${n === 1 ? '' : r === 2 ? '' : 's'}`);
    contas.append(sp);
  }
  const lancados = estilosLancados(cad, atual);
  const focos = el('p', 'tee-resumo-foco', lancados.length
    ? `Foco ideal: ${lancados.filter((e) => cad.focos.has(e)).length} de ${lancados.length} ${lancados.length === 1 ? 'estilo lançado' : 'estilos lançados'}`
    : 'Foco ideal: lança uma coleção pra poder descobrir.');
  const abrir = button('Abrir o caderninho', 'btn compacto tee-abrir-caderno', () => atual?.abrirCaderno());
  abrir.dataset.foco = 'tee-abrir-caderno';
  abrir.disabled = !atual;
  raiz.append(linha);
  if (contas.childNodes.length) raiz.append(contas);
  raiz.append(focos, abrir);
  return raiz;
}

/** A camisetaria como mecânica da moldura (uma por app; os testes criam a delas). */
export function criarCamisetaria(): Mecanica {
  let atual: Atual | null = null;
  return {
    criar: (a, dicas) => criarTela(a, dicas, (x) => { atual = x; }),
    foto(partes) {
      try {
        return canvasDe(fotoImagem(partes));
      } catch {
        const c = document.createElement('canvas');
        c.width = LADO_FOTO;
        c.height = LADO_FOTO;
        return c;
      }
    },
    caderninho: (itens) => criarResumoCaderninho(itens, atual),
    libera: liberaTextos,
  };
}

export const CAMISETARIA = criarCamisetaria();
