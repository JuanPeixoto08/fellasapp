// O copão (lugar 4 do Mapa do rolê) na tela, no estilo do bar à noite: parede escura, neon vermelho, garrafas sem rótulo.
// Estados:
// * bar: a noite de hoje (relógio até as 18h ou até as 2h, o que já vendeu subindo, a sexta e o DJ), o cardápio (as vagas:
//   foto, nome, nota ou "estreia hoje 18h", novidade, vendas, Tirar), a última noite (Ver o chat) e a última noite que
//   ninguém abriu;
// * montar (numa vaga livre): base, mistura, extra, tamanho, força, preço, nome, a prévia e "Pôr no cardápio";
// * djs: quem toca na sexta (os retratos, o som e as bases que vendem mais com cada um);
// * revelação (uma vez por copão, guardada por pessoa, quando ele vendeu a primeira noite inteira): a nota subindo com as 4
//   partes (sabor, custo-benefício, moda, aguenta), os pares e quão longe do ponto a força ficou;
// * chat (uma vez por noite, por pessoa): o que a galera falou da última noite que fechou, as fichas e a galera.
// O caderninho (a faixa da moldura) abre o completo no miolo: os pares testados e a força que aguenta por base.
// Se a pessoa sai no meio da revelação ou do chat, ao voltar eles recomeçam. Quem decide é o banco (idle_cup_*).
import { button, el } from '../shared/hud/hud';
import type { LugarEstado, NotaCaderninho } from '../shared/types';
import { ativos } from './ativos';
import {
  aBase, BASES, cadernoCup, chavePar, daBase, diaBR, distanciaCurta, vagasFuturas, distanciaTexto, DJS, EXTRAS, forcaTestada, liberado, liberaTextos, lucroVenda, MISTURAS,
  NOME_ROTULO, nomeSugerido, novidade, pontoDescoberto, precoFaixa, precoRef, proximaNoite, rotulos, TAMANHOS,
  type CadernoCup, type CopaoCup, type EstadoCup, type TipoPar, type UltimaNoite,
} from './copao';
import { balao, canvasDe, COR_BASE, COR_MISTURA, extraImagem, fotoImagem, fundoBar, LADO_FOTO, recipiente } from './copaoArte';
import { chatDaNoite } from './copaoChat';
import {
  dicaCupBase, dicaCupDj, dicaCupExtra, dicaCupForca, dicaCupMistura, dicaCupPreco, dicaCupTamanho, dicaCupTrancados, dicaCupVaga,
} from './dica';
import { criarFoco } from './foco';
import { formatarValor } from './formatar';
import type { AcoesMecanica, Dicas, Mecanica, TelaMecanica } from './mecanicas';

/** Os copões que a pessoa já viu revelar e as noites cujo chat ela já viu: uma lista por pessoa (`<chave>:<user_id>`). */
export const CHAVE_REVELADO = 'fellas:cup-revelado';
export const CHAVE_NOITE = 'fellas:cup-noite';
export const chaveRevelado = (uid: string | null) => `${CHAVE_REVELADO}:${uid ?? 'anon'}`;
export const chaveNoite = (uid: string | null) => `${CHAVE_NOITE}:${uid ?? 'anon'}`;
const MAX_VISTOS = 40;

type Tipo = 'base' | 'mistura' | 'extra' | 'tamanho';
type Vista = 'bar' | 'montar' | 'djs';
type Estado = 'carregando' | Vista | 'revelacao' | 'chat' | 'caderno';
type Atual = { a: AcoesMecanica; dicas: Dicas; l: LugarEstado; m: EstadoCup; ocupado: boolean; abrirCaderno(): void };

const H = 3600_000;
/** A revelação: as 4 partes enchem uma depois da outra (PARTE_MS cada) e a nota sobe junto. */
const PARTE_MS = 420;
const REV_INICIO = 250;
/** O chat: uma mensagem a cada MSG_MS. */
const MSG_MS = 420;
const NOVA_TENTATIVA_MS = 3000;
const LISTAS: Record<Tipo, readonly { id: number; nome: string; nivel: number }[]> = { base: BASES, mistura: MISTURAS, extra: EXTRAS, tamanho: TAMANHOS };
const ROTULO_TIPO: Record<Tipo, string> = { base: 'Base', mistura: 'Mistura', extra: 'Extra', tamanho: 'Tamanho' };
/** O nome curto no ladrilho (a caixinha e o leitor de tela dizem o nome inteiro). */
export const ABREV_BASE = ['Vod', 'Cach', 'Catu', 'Gin', 'Rum', 'Whis', 'Teq', 'Corot', 'Choc', 'Saq', 'Abs', 'Vinho'];
export const ABREV_MISTURA = ['Ener', 'Guar', 'Lar', 'Cola', 'Melan', 'Marac', 'Tôn', 'Açaí', 'Limão', 'Gros', 'Chá', 'Trop', 'Iso', 'Leite', 'Zero'];
export const ABREV_EXTRA = ['Lim', 'Coco', 'Mor', 'Mara', 'Hort', 'Bala', 'Abac', 'Can', 'Pim', 'Sal', 'Açúc', 'Fruta'];
const PARTES = [['Sabor', 'sabor', 399], ['Custo-benefício', 'cb', 250], ['Moda', 'moda', 150], ['Aguenta', 'aguenta', 199]] as const;
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Ficha resumida como o F$ ("1,2 mil"), sem o "F$". */
const quantia = (n: number) => formatarValor(n).replace('F$ ', '');
const inteiro = (n: number) => Math.round(n).toLocaleString('pt-BR');
const comSinal = (n: number) => (n >= 0 ? `+${quantia(n)}` : `−${quantia(-n)}`);
/** Quanto a galera mudou: "+3", "−2"; o que arredonda pra 0 é "igual" (nunca "+0" nem "−0"). */
const galeraMudou = (d: number) => (Math.round(Math.abs(d)) === 0 ? 'igual' : `${d > 0 ? '+' : '−'}${inteiro(Math.abs(d))}`);
const minusc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** Fichas de uma venda: com uma casa abaixo de 10 ("0,4", "7,5"); acima, como o resto ("22", "1,2 mil"). */
const fichasVenda = (n: number) => (n < 10 ? (Math.round(n * 10) / 10).toLocaleString('pt-BR') : quantia(n));

const nomeTier = (nota: number) => `nota-${nota >= 800 ? 'top' : nota >= 600 ? 'boa' : nota >= 300 ? 'meh' : 'ruim'}`;
const partesDe = (c: { base: number; mistura: number; extra: number; tamanho: number; forca: number }) => [c.base, c.mistura, c.extra, c.tamanho, c.forca];
const descrever = (c: { base: number; mistura: number; extra: number; tamanho: number; forca: number }) =>
  `${TAMANHOS[c.tamanho - 1].nome} de ${BASES[c.base - 1].nome} com ${minusc(MISTURAS[c.mistura - 1].nome)} e ${minusc(EXTRAS[c.extra - 1].nome)}, força ${c.forca}`;

/** "45 min", "2 h", "1 h 12 min" (arredonda pra cima: nunca diz 0 antes da hora). */
function tempo(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
/** "hoje", "amanhã" ou "na quinta" / "no sábado" (em Brasília) de uma noite que começa em `ini`. */
function quando(ini: number, agora: number): string {
  const d = diaBR(ini) - diaBR(agora);
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanhã';
  const dia = new Date(ini - 3 * H).getUTCDay();
  return `${dia === 0 || dia === 6 ? 'no' : 'na'} ${DIAS[dia]}`;
}
/** "ontem" ou "na terça" / "no sábado": o dia (em Brasília) de uma noite que já passou. */
function quandoFoi(ini: number, agora: number): string {
  if (diaBR(agora) - diaBR(ini) <= 1) return 'ontem';
  const dia = new Date(ini - 3 * H).getUTCDay();
  return `${dia === 0 || dia === 6 ? 'no' : 'na'} ${DIAS[dia]}`;
}
/** O título da última noite: "Ontem à noite" ou "Na noite de terça (07/10)". */
function tituloNoite(ini: number, agora: number): string {
  if (diaBR(agora) - diaBR(ini) <= 1) return 'Ontem à noite';
  const d = new Date(ini - 3 * H);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `Na noite de ${DIAS[d.getUTCDay()]} (${dd}/${mm})`;
}

function pinta(c: HTMLCanvasElement, img: ImageData): void {
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')?.putImageData(img, 0, 0);
}
const fotoCanvas = (cls: string, partes: number[], rotulo: string | null) => {
  const c = el('canvas', cls);
  try { pinta(c, fotoImagem(partes)); } catch { c.width = LADO_FOTO; c.height = LADO_FOTO; }
  if (rotulo) {
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', rotulo);
  } else c.setAttribute('aria-hidden', 'true');
  return c;
};

// ----- o que já viu (localStorage por pessoa; sem localStorage, a memória desta aba) -----
const vistosAqui = new Map<string, Set<number>>();
function lerVistos(chave: string): number[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(chave) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}
const jaViu = (chave: string, id: number) => vistosAqui.get(chave)?.has(id) === true || lerVistos(chave).includes(id);
function gravarVisto(chave: string, id: number): void {
  const aqui = vistosAqui.get(chave) ?? new Set<number>();
  aqui.add(id);
  vistosAqui.set(chave, aqui);
  try {
    localStorage.setItem(chave, JSON.stringify([...lerVistos(chave).filter((x) => x !== id), id].slice(-MAX_VISTOS)));
  } catch {
    // sem localStorage: fica só na memória desta aba
  }
}
const movimentoReduzido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A parede do bar como imagem de fundo (uma vez só; sem canvas, fica a cor do lugar). */
let barUrl: string | null | undefined;
function parede(alvo: HTMLElement): void {
  if (barUrl === undefined) {
    try {
      const u = canvasDe(fundoBar()).toDataURL('image/png');
      barUrl = u.startsWith('data:image/png') && u.length > 30 ? u : null;
    } catch {
      barUrl = null;
    }
  }
  if (barUrl) alvo.style.backgroundImage = `url(${barUrl})`;
}
/** A cauda pixelada do balão do chat (da arte), por tipo e lado. */
const caudas = new Map<string, string | null>();
function cauda(tipo: 'galera' | 'pt' | 'dj', lado: 'esq' | 'dir'): string | null {
  const k = `${tipo}:${lado}`;
  if (!caudas.has(k)) {
    try {
      const b = balao(12, 6, lado, tipo);
      const corte = new ImageData(12, 5);
      corte.data.set(b.data.subarray(4 * 12 * 4, 4 * 12 * 9));
      const u = canvasDe(corte).toDataURL('image/png');
      caudas.set(k, u.startsWith('data:image/png') && u.length > 30 ? u : null);
    } catch {
      caudas.set(k, null);
    }
  }
  return caudas.get(k) ?? null;
}

function cadeado(): HTMLElement {
  const c = el('i', 'pino-cadeado');
  const url = ativos.estudio('cadeado');
  if (url) c.style.backgroundImage = `url(${url})`;
  c.setAttribute('aria-hidden', 'true');
  return c;
}
function retrato(dj: number | null, cls: string): HTMLElement {
  const r = el('span', `cup-retrato ${cls}`);
  r.setAttribute('aria-hidden', 'true');
  const url = dj ? ativos.dj(dj) : null;
  if (url) r.style.backgroundImage = `url(${url})`;
  else r.classList.add('vazio');
  return r;
}
const listaBases = (ids: readonly number[]) => {
  const n = ids.map((b) => BASES[b - 1].nome);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} e ${n.at(-1)}` : n.join('');
};

/** Quanto a noite de hoje já vendeu (ou rendeu de fichas, que pode ser negativo) em `t`: a venda é linear nas 8 h, então
 *  segue a conta do banco (o que ele contou em `servidor`) na mesma reta, até o fim. `parado` = o que já está no contado e
 *  não anda mais (os copões que saíram no meio da noite). */
export function vendidoHoje(contado: number, ini: number, fim: number, servidor: number, t: number, parado = 0): number {
  const ate = Math.min(servidor, fim) - ini;
  const anda = contado - parado;
  if (ate <= 0 || anda === 0) return contado;
  return parado + (anda * (Math.min(Math.max(t, ini), fim) - ini)) / ate;
}

function criarTela(a: AcoesMecanica, dicas: Dicas, avisar: (x: Atual) => void): TelaMecanica {
  const raiz = el('div', 'cup');
  raiz.dataset.estado = 'carregando';
  const foco = criarFoco(raiz);
  const sel = { base: 1, mistura: 1, extra: 1, tamanho: 2, forca: 5, preco: 0, precoMexido: false, n: 0 };
  let ultimo: { l: LugarEstado; m: EstadoCup; ocupado: boolean } | null = null;
  let relogio = 0; // agora do servidor − Date.now()
  const agora = () => Date.now() + relogio;
  let servidorMs = 0;
  let estado: Estado = 'carregando';
  let vista: Vista = 'bar';
  let vendoCaderno = false;
  let chatManual = false;
  /** O que está animando agora ("rev:<id>", "chat:<noite>"): um desenho novo do banco não recomeça. */
  let animando: string | null = null;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let tick: (() => void) | null = null;
  let intervalo: ReturnType<typeof setInterval> | null = null;
  const pedidos = new Set<string>();
  let tentativas: ReturnType<typeof setTimeout>[] = [];
  let tirando: number | null = null;
  /** Os copões do cardápio quando abriu o montar: apareceu um novo = deu certo, volta pro bar. */
  let idsAoMontar: Set<number> | null = null;
  const uid = () => a.usuario?.() ?? null;

  const pedir = (k: string, aindaIgual: () => boolean) => {
    if (pedidos.has(k)) return;
    pedidos.add(k);
    a.recarregar?.();
    const id = setTimeout(() => {
      tentativas = tentativas.filter((x) => x !== id);
      if (raiz.isConnected && aindaIgual()) a.recarregar?.();
    }, NOVA_TENTATIVA_MS);
    tentativas.push(id);
  };
  const limparTimers = () => {
    for (const t of timers) clearTimeout(t);
    timers = [];
  };
  function garantirIntervalo() {
    if (intervalo) return;
    intervalo = setInterval(() => {
      if (!raiz.isConnected) {
        // saiu da página: para o relógio, as segundas tentativas e a animação (ao voltar, recomeça)
        if (intervalo) clearInterval(intervalo);
        intervalo = null;
        for (const t of tentativas) clearTimeout(t);
        tentativas = [];
        limparTimers();
        animando = null;
        return;
      }
      tick?.();
    }, 1000);
  }

  const cadAtual = (): CadernoCup => cadernoCup(ultimo?.l.caderninho ?? []);
  const nivelAtual = () => ultimo?.l.nivel ?? 1;
  const djEscolhido = () => ultimo?.m.dj ?? null;
  /** A noite de hoje já começou no último JSON (server_now depois do início): a linha dela existe e o DJ é o gravado nela. */
  const noiteComecou = (m: EstadoCup) => servidorMs >= Date.parse(m.hoje.inicio);
  /** A sexta de hoje já começou: o DJ dela é o gravado na noite, mesmo sem DJ; trocar agora vale a partir da próxima. */
  const sextaComecou = (m: EstadoCup) => m.hoje.sexta && noiteComecou(m);
  /** O DJ que vale na noite de hoje: o gravado quando ela começou; antes disso, o escolhido. */
  const djDaNoite = (m: EstadoCup) => (noiteComecou(m) ? m.hoje.dj : m.dj);

  // ===================== bar =====================
  function blocoNoite(m: EstadoCup, ocupado: boolean, atualizar: (() => void)[]): HTMLElement {
    const s = el('section', 'cup-noite');
    s.setAttribute('aria-label', 'Hoje à noite');
    const ini = Date.parse(m.hoje.inicio);
    const fim = Date.parse(m.hoje.fim);

    const rel = el('div', 'cup-relogio');
    const status = el('span', 'cup-status');
    const conta = el('b', 'cup-conta');
    const linha = el('p', 'cup-noite-linha');
    const vendas = el('p', 'cup-vendas');
    vendas.setAttribute('aria-live', 'off');
    rel.append(status, conta, linha, vendas);

    atualizar.push(() => {
      const t = agora();
      const rodando = t >= ini && t < fim;
      s.classList.toggle('aberto', rodando && m.hoje.aberta);
      if (t < ini) {
        status.textContent = 'Fechado';
        conta.textContent = `Abre em ${tempo(ini - t)}`;
        linha.textContent = `${quando(ini, t) === 'hoje' ? 'Hoje' : 'Amanhã'} das 18h às 2h. O que estiver no cardápio vende sozinho.`;
        vendas.textContent = '';
      } else if (rodando && m.hoje.aberta) {
        // o que os copões que saíram no meio da noite venderam fica parado; o resto anda
        const noCardapio = (k: 'vendido_hoje' | 'fichas_hoje') => m.cardapio.reduce((soma, c) => soma + (c[k] ?? 0), 0);
        const v = vendidoHoje(m.hoje.vendido_ate_agora, ini, fim, servidorMs, t, m.hoje.vendido_ate_agora - noCardapio('vendido_hoje'));
        const f = vendidoHoje(m.hoje.fichas_ate_agora, ini, fim, servidorMs, t, m.hoje.fichas_ate_agora - noCardapio('fichas_hoje'));
        status.textContent = 'Aberto';
        conta.textContent = `Fecha em ${tempo(fim - t)}`;
        linha.textContent = 'Até as 2h. A galera tá pedindo.';
        vendas.replaceChildren(el('b', undefined, `${inteiro(Math.floor(v))} vendidos`), ' · ', el('span', 'cup-fichas', `${comSinal(f)} fichas`));
      } else if (rodando) {
        status.textContent = 'Fechado hoje';
        conta.textContent = `Abre de novo em ${tempo(ini + 24 * H - t)}`;
        linha.textContent = 'Ninguém abriu o bar: você não passou aqui desde ontem à noite.';
        vendas.textContent = '';
      } else {
        status.textContent = 'Fechou';
        conta.textContent = 'Contando a noite…';
        linha.textContent = '';
        vendas.textContent = '';
      }
      // a noite começou ou acabou: busca o lugar de novo (a linha da noite e o que cada copão vende, as revelações, o chat)
      if (t >= ini && t < fim && servidorMs < ini) {
        pedir(`ini:${m.hoje.inicio}`, () => !!ultimo?.m.cardapio.some((c) => c.vendido_hoje === null && Date.parse(c.primeira_noite) <= ini));
      }
      if (t >= fim && servidorMs < fim) pedir(`fim:${m.hoje.inicio}`, () => ultimo?.m.hoje.inicio === m.hoje.inicio);
    });

    // a sexta e o DJ
    const sexta = el('div', 'cup-sexta');
    const comecou = sextaComecou(m);
    const djId = comecou ? m.hoje.dj : m.dj;
    const dj = djId ? DJS[djId - 1] : null;
    const info = el('div', 'cup-sexta-info');
    info.append(el('span', 'cup-sexta-tit', m.hoje.sexta ? 'Hoje é sexta: movimento ×2' : 'Na sexta: movimento ×2'));
    if (dj) {
      info.append(el('strong', 'cup-dj-nome', dj.nome), el('span', 'cup-dj-estilo', `${dj.estilo} · DJ da sexta`),
        el('p', 'cup-curte', `+20% em copão de ${listaBases(dj.bases)}`));
    } else info.append(el('strong', 'cup-dj-nome', 'Sem DJ'), el('p', 'cup-curte', comecou ? 'Hoje a sexta começou sem DJ.'
      : 'Escolhe quem toca: o DJ dá +20% nos copões das bases que combinam com o som dele.'));
    if (comecou && m.dj !== m.hoje.dj) info.append(el('p', 'cup-info cup-dj-proxima', `Na próxima sexta: ${m.dj ? DJS[m.dj - 1].nome : 'sem DJ'}.`));
    const trocar = button(dj ? 'Trocar DJ' : 'Escolher DJ', 'btn compacto cup-trocar-dj', () => {
      vista = 'djs';
      redesenhar();
      raiz.querySelector<HTMLElement>('.cup-dj[aria-checked="true"], .cup-dj')?.focus();
    });
    trocar.dataset.foco = 'cup-trocar-dj';
    trocar.disabled = ocupado;
    if (dj) dicas.ligar(sexta, 'cup-dj-sexta', `DJ da sexta: ${dj.nome}`, () => dicaCupDj(dj.id, nivelAtual(), true));
    sexta.append(retrato(djId, 'cup-retrato-sexta'), info, trocar);
    s.append(rel, sexta);
    return s;
  }

  function cartaoVaga(c: CopaoCup, m: EstadoCup, ocupado: boolean, atualizar: (() => void)[]): HTMLElement {
    const li = el('li', 'cup-vaga');
    li.dataset.id = String(c.id);
    li.tabIndex = 0;
    li.dataset.foco = `cup-vaga-${c.id}`;
    const foto = el('div', 'cup-vaga-foto');
    parede(foto);
    foto.append(fotoCanvas('cup-foto-vaga', partesDe(c), descrever(c)));
    const nome = el('strong', 'cup-vaga-nome', c.nome);
    li.append(foto, nome);
    const ini = Date.parse(m.hoje.inicio);
    const fim = Date.parse(m.hoje.fim);
    if (c.revelado && c.nota !== null) {
      const n = el('p', `cup-vaga-nota ${nomeTier(c.nota)}`);
      n.append(el('b', undefined, String(c.nota)), el('span', undefined, 'nota'));
      li.append(n);
    } else {
      // a nota sai quando ele vende a primeira noite inteira: estreando agora, às 2h
      const pn = Date.parse(c.primeira_noite);
      const t = agora();
      li.append(el('p', 'cup-estreia', pn > t ? `Estreia ${quando(pn, t)} às 18h`
        : c.vendido_hoje !== null && t < fim ? 'Estreando: nota às 2h' : 'Nota no fim da próxima noite'));
    }
    const nov = el('p', 'cup-vaga-linha', `Novidade ${Math.round(novidade(c.noites) * 100)}%`);
    const vendas = el('p', 'cup-vaga-linha cup-vaga-vendas');
    li.append(nov, vendas);
    const ult = m.ultima_noite?.copoes.find((x) => x.id === c.id);
    atualizar.push(() => {
      const t = agora();
      if (t >= ini && t < fim && m.hoje.aberta && c.vendido_hoje !== null) {
        const v = vendidoHoje(c.vendido_hoje, ini, fim, servidorMs, t);
        vendas.textContent = `Hoje: ${inteiro(Math.floor(v))} vendidos`;
      } else if (ult) {
        const ontem = diaBR(t) - diaBR(Date.parse(m.ultima_noite!.inicio)) <= 1;
        vendas.textContent = `${ontem ? 'Ontem' : 'Última noite'}: ${inteiro(Math.floor(ult.vendidos))} vendidos`;
      }
      else vendas.textContent = Date.parse(c.primeira_noite) > t ? 'Vende a partir da estreia' : 'Ainda não vendeu';
    });
    dicas.ligar(li, `cup-vaga-${c.id}`, c.nome, () => dicaCupVaga(c));

    if (tirando === c.id) {
      const box = el('div', 'cup-confirma');
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', `Tirar ${c.nome}`);
      const sim = button('Tirar', 'btn compacto cup-tirar-sim', () => {
        tirando = null;
        a.acao('idle_cup_tirar', { p_copao: c.id });
      });
      const nao = button('Deixa', 'btn compacto main cup-tirar-nao', () => {
        tirando = null;
        redesenhar();
        raiz.querySelector<HTMLElement>(`[data-foco="cup-tirar-${c.id}"]`)?.focus();
      });
      sim.dataset.foco = `cup-tirar-sim-${c.id}`;
      nao.dataset.foco = `cup-tirar-nao-${c.id}`;
      sim.disabled = ocupado;
      box.append(el('p', undefined, 'Sai do cardápio pra sempre.'), nao, sim);
      li.append(box);
    } else {
      const tirar = button('Tirar', 'btn compacto cup-tirar', () => {
        tirando = c.id;
        redesenhar();
        raiz.querySelector<HTMLElement>(`[data-foco="cup-tirar-nao-${c.id}"]`)?.focus();
      });
      tirar.dataset.foco = `cup-tirar-${c.id}`;
      tirar.setAttribute('aria-label', `Tirar ${c.nome} do cardápio`);
      tirar.disabled = ocupado;
      li.append(tirar);
    }
    return li;
  }

  function desenharBar(l: LugarEstado, m: EstadoCup, ocupado: boolean) {
    const atualizar: (() => void)[] = [];
    const s = el('div', 'cup-bar');
    s.append(blocoNoite(m, ocupado, atualizar));

    const card = el('section', 'cup-cardapio');
    const usadas = m.cardapio.length;
    const tit = el('h4', 'cup-rot');
    tit.append(el('span', undefined, 'Cardápio'), el('span', 'cup-rot-valor', `${usadas} de ${m.vagas} ${m.vagas === 1 ? 'vaga' : 'vagas'}`));
    const ol = el('ol', 'cup-vagas');
    for (const c of m.cardapio) ol.append(cartaoVaga(c, m, ocupado, atualizar));
    for (let i = usadas; i < m.vagas; i++) {
      const li = el('li', 'cup-vaga livre');
      const bt = button('', 'cup-montar-vaga', () => abrirMontar());
      bt.dataset.foco = `cup-montar-${i}`;
      bt.disabled = ocupado;
      bt.append(el('span', 'cup-mais', '+'), el('span', undefined, usadas === 0 && i === 0 ? 'Montar o primeiro copão' : 'Montar copão'));
      li.append(bt);
      ol.append(li);
    }
    // as vagas que ainda vão chegar (4ª no nível 12, 5ª no 20)
    for (const [vaga, nivel] of vagasFuturas(l.nivel ?? 1)) {
      const li = el('li', 'cup-vaga trancada');
      li.setAttribute('aria-label', `${vaga}ª vaga: libera no nível ${nivel}`);
      li.append(cadeado(), el('span', 'cup-niv', `nív. ${nivel}`));
      ol.append(li);
    }
    card.append(tit, ol);
    s.append(card);

    // o pé: a moda da semana e a última noite
    const pe = el('footer', 'cup-pe');
    const moda = el('p', 'cup-moda');
    moda.append(el('span', 'cup-pe-rot', 'Moda da semana'),
      `${BASES[m.moda.base - 1].nome} + ${minusc(MISTURAS[m.moda.mistura - 1].nome)}`,
      el('span', 'cup-pe-sub', 'vale pra quem entrar no cardápio esta semana'));
    pe.append(moda);
    const u = m.ultima_noite;
    const fechada = m.noite_fechada;
    if (u || fechada) {
      const dir = el('div', 'cup-pe-dir');
      if (u) {
        const ontem = el('div', 'cup-ontem');
        const p = el('p', 'cup-ontem-num');
        const g = galeraMudou(u.galera_delta);
        p.append(el('span', 'cup-pe-rot', tituloNoite(Date.parse(u.inicio), agora())),
          `${inteiro(Math.floor(u.vendas))} vendidos · `, el('span', 'cup-fichas', `${comSinal(u.fichas)} fichas`),
          ` · galera ${g}${u.pt ? ' · deu PT' : ''}`);
        const ver = button('Ver o chat', 'btn compacto cup-ver-chat', () => {
          chatManual = true;
          redesenhar();
        });
        ver.dataset.foco = 'cup-ver-chat';
        ontem.append(p, ver);
        dir.append(ontem);
      }
      // a noite que ninguém abriu (mais nova que a última aberta): uma linha embaixo
      if (fechada) dir.append(el('p', 'cup-pe-sub cup-fechada', `Ninguém abriu o bar ${quandoFoi(Date.parse(fechada.inicio), agora())}`));
      pe.append(dir);
    }
    s.append(pe);

    raiz.replaceChildren(s);
    tick = () => { for (const f of atualizar) f(); };
    tick();
  }

  // ===================== montar =====================
  const nome = el('input', 'cup-nome');
  nome.type = 'text';
  nome.maxLength = 30;
  nome.autocomplete = 'off';
  nome.spellcheck = false;
  nome.dataset.foco = 'cup-nome';
  nome.setAttribute('aria-label', 'Nome do copão');
  nome.addEventListener('input', () => atualizarMontar());
  nome.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !por.disabled) por.click();
  });
  const sortear = button('Sortear', 'btn compacto cup-sortear', () => {
    sel.n++;
    nome.value = nomeSugerido(sel.base, sel.mistura, sel.extra, sel.tamanho, sel.n);
    atualizarMontar();
  });
  sortear.dataset.foco = 'cup-sortear';
  const por = button('Pôr no cardápio', 'btn main cup-por', () => {
    if (!ultimo) return;
    a.acao('idle_cup_por', {
      p_base: sel.base, p_mistura: sel.mistura, p_extra: sel.extra, p_tamanho: sel.tamanho, p_forca: sel.forca, p_preco: sel.preco,
      p_nome: nome.value.trim() || nome.placeholder,
    });
  });
  por.dataset.foco = 'cup-por';
  const voltarMontar = button('Voltar', 'btn compacto cup-voltar', () => {
    vista = 'bar';
    idsAoMontar = null;
    redesenhar();
    raiz.querySelector<HTMLElement>('.cup-montar-vaga')?.focus();
  });
  voltarMontar.dataset.foco = 'cup-voltar';
  const aviso = el('p', 'cup-aviso');
  aviso.setAttribute('aria-live', 'polite');
  let avisosPor: string[] = [];

  type Montar = {
    el: HTMLElement; nivel: number; botoes: Record<Tipo, HTMLButtonElement[]>; nomes: Record<Tipo, HTMLElement>; foto: HTMLCanvasElement;
    placa: HTMLElement; forcas: HTMLButtonElement[]; forcaValor: HTMLElement; forcaInfo: HTMLElement; precoValor: HTMLElement;
    precoRange: HTMLInputElement; precoMenos: HTMLButtonElement; precoMais: HTMLButtonElement; precoInfo: HTMLElement;
    tamanhos: HTMLCanvasElement[]; altaTrancada: HTMLElement; modaTexto: HTMLElement; chaveArte: string;
  };
  let montar: Montar | null = null;

  function escolher(tipo: Tipo, id: number) {
    if (!liberado(tipo, id, nivelAtual())) return;
    sel[tipo] = id;
    atualizarMontar();
  }
  function setas(e: KeyboardEvent, tipo: Tipo, i: number) {
    const passo = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
    const lista = montar?.botoes[tipo];
    if (!passo || !lista) return;
    e.preventDefault();
    const k = (i + passo + lista.length) % lista.length;
    lista[k].focus();
    escolher(tipo, k + 1);
  }

  function ladrilho(tipo: Tipo, id: number): { bt: HTMLButtonElement; arte: HTMLCanvasElement | null } {
    const item = LISTAS[tipo][id - 1];
    const bt = el('button', `cup-item cup-${tipo}`);
    bt.type = 'button';
    bt.setAttribute('role', 'radio');
    bt.setAttribute('aria-label', item.nome);
    bt.dataset.foco = `cup-${tipo}-${id}`;
    let arte: HTMLCanvasElement | null = null;
    if (tipo === 'base' || tipo === 'mistura') {
      const gota = el('span', 'cup-gota');
      gota.style.setProperty('--cor', (tipo === 'base' ? COR_BASE : COR_MISTURA)[id - 1]);
      bt.append(gota, el('span', 'cup-abrev', (tipo === 'base' ? ABREV_BASE : ABREV_MISTURA)[id - 1]));
    } else if (tipo === 'extra') {
      arte = el('canvas', 'cup-arte-extra');
      arte.setAttribute('aria-hidden', 'true');
      try { pinta(arte, extraImagem(id)); } catch { /* sem arte */ }
      bt.append(arte, el('span', 'cup-abrev', ABREV_EXTRA[id - 1]));
    } else {
      arte = el('canvas', 'cup-arte-tamanho');
      arte.setAttribute('aria-hidden', 'true');
      bt.append(arte, el('span', 'cup-abrev', TAMANHOS[id - 1].nome));
    }
    bt.addEventListener('click', () => escolher(tipo, id));
    bt.addEventListener('keydown', (e) => setas(e, tipo, id - 1));
    dicas.ligar(bt, `cup-${tipo}-${id}`, item.nome, () => {
      const n = nivelAtual();
      const cad = cadAtual();
      const m = ultimo?.m;
      if (tipo === 'base') return dicaCupBase(id, sel.mistura, sel.extra, n, cad, m?.moda.base ?? 0, djEscolhido());
      if (tipo === 'mistura') return dicaCupMistura(id, sel.base, sel.extra, n, cad, m?.moda.mistura ?? 0);
      if (tipo === 'extra') return dicaCupExtra(id, sel.base, sel.mistura, n, cad);
      return dicaCupTamanho(id, sel.base, sel.forca, n);
    });
    return { bt, arte };
  }

  function grade(tipo: Tipo, nivel: number, b: Montar): HTMLElement {
    const g = el('div', `cup-grade cup-grade-${tipo}`);
    g.setAttribute('role', 'radiogroup');
    g.setAttribute('aria-label', ROTULO_TIPO[tipo]);
    b.botoes[tipo] = [];
    for (const item of LISTAS[tipo].filter((x) => liberado(tipo, x.id, nivel))) {
      const { bt, arte } = ladrilho(tipo, item.id);
      if (tipo === 'tamanho' && arte) b.tamanhos.push(arte);
      b.botoes[tipo].push(bt);
      g.append(bt);
    }
    const trancados = LISTAS[tipo].filter((x) => !liberado(tipo, x.id, nivel));
    if (trancados.length) {
      const t = el('span', `cup-item cup-trancados cup-trancados-${tipo}`);
      t.tabIndex = 0;
      t.dataset.foco = `cup-${tipo}-trancados`;
      t.setAttribute('role', 'note');
      t.setAttribute('aria-label', dicaCupTrancados(tipo, nivel));
      const prox = trancados.reduce((x, y) => (y.nivel < x.nivel ? y : x));
      t.append(cadeado(), el('span', 'cup-niv', `nív. ${prox.nivel}`), el('span', 'cup-mais-n', `+${trancados.length}`));
      dicas.ligar(t, `cup-${tipo}-trancados`, 'Trancado', () => dicaCupTrancados(tipo, nivelAtual()));
      g.append(t);
    }
    return g;
  }

  function secao(cls: string, titulo: string, escolhido?: HTMLElement): HTMLElement {
    const s = el('section', `cup-secao ${cls}`);
    const h = el('h4', 'cup-rot');
    h.append(el('span', undefined, titulo));
    if (escolhido) h.append(escolhido);
    s.append(h);
    return s;
  }

  function montarMontar(nivel: number): Montar {
    const b = {
      el: el('div', 'cup-montar'), nivel, botoes: {}, nomes: {}, foto: el('canvas', 'cup-foto-previa'), placa: el('p', 'cup-placa'), forcas: [],
      forcaValor: el('span', 'cup-rot-valor'), forcaInfo: el('p', 'cup-info cup-forca-info'), precoValor: el('span', 'cup-rot-valor'),
      precoRange: el('input', 'cup-preco-range'), precoMenos: button('−', 'btn cup-passo cup-preco-menos', () => mudarPreco(-1)),
      precoMais: button('+', 'btn cup-passo cup-preco-mais', () => mudarPreco(1)), precoInfo: el('p', 'cup-info cup-preco-info'), tamanhos: [],
      altaTrancada: el('span', 'cup-alta-trancada'), modaTexto: el('p', 'cup-info cup-moda-montar'), chaveArte: '',
    } as unknown as Montar;
    for (const t of ['base', 'mistura', 'extra', 'tamanho'] as const) b.nomes[t] = el('span', `cup-sel cup-sel-${t}`);

    // à esquerda: a prévia no balcão, o nome, a força, o preço e o Pôr
    const lado = el('div', 'cup-lado');
    const previa = el('div', 'cup-previa');
    parede(previa);
    b.foto.setAttribute('role', 'img');
    previa.append(b.foto, b.placa);
    const linhaNome = el('div', 'cup-linha-nome');
    linhaNome.append(nome, sortear);

    const forcaS = secao('cup-forca', 'Força', b.forcaValor);
    const forcas = el('div', 'cup-forcas');
    forcas.setAttribute('role', 'radiogroup');
    forcas.setAttribute('aria-label', 'Força');
    for (let f = 1; f <= 10; f++) {
      const bt = el('button', 'cup-f', String(f));
      bt.type = 'button';
      bt.setAttribute('role', 'radio');
      bt.dataset.foco = `cup-forca-${f}`;
      bt.addEventListener('click', () => mudarForca(f));
      bt.addEventListener('keydown', (e) => {
        const passo = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[e.key];
        if (!passo) return;
        e.preventDefault();
        const nf = Math.min(10, Math.max(1, f + passo));
        mudarForca(nf);
        b.forcas[nf - 1].focus();
      });
      b.forcas.push(bt);
      forcas.append(bt);
    }
    dicas.ligar(forcaS, 'cup-forca', 'Força', () => dicaCupForca(sel.base, sel.forca, cadAtual()));
    forcaS.append(forcas, b.forcaInfo);

    const precoS = secao('cup-preco', 'Preço', b.precoValor);
    b.precoRange.type = 'range';
    b.precoRange.step = '1';
    b.precoRange.dataset.foco = 'cup-preco-range';
    b.precoRange.setAttribute('aria-label', 'Preço em fichas');
    b.precoRange.addEventListener('input', () => {
      sel.preco = Number(b.precoRange.value);
      sel.precoMexido = true;
      atualizarMontar();
    });
    b.precoMenos.setAttribute('aria-label', 'Uma ficha a menos');
    b.precoMais.setAttribute('aria-label', 'Uma ficha a mais');
    b.precoMenos.dataset.foco = 'cup-preco-menos';
    b.precoMais.dataset.foco = 'cup-preco-mais';
    const linhaPreco = el('div', 'cup-linha-preco');
    linhaPreco.append(b.precoMenos, b.precoRange, b.precoMais);
    dicas.ligar(precoS, 'cup-preco', 'Preço', () => dicaCupPreco(sel));
    precoS.append(linhaPreco, b.precoInfo);

    const fim = el('div', 'cup-fim');
    const bts = el('div', 'cup-fim-bts');
    bts.append(voltarMontar, por);
    fim.append(bts, aviso);
    dicas.ligar(fim, 'cup-por', 'Pôr no cardápio', () => avisosPor.join(' '));
    lado.append(previa, linhaNome, forcaS, precoS, fim);

    // à direita: as escolhas
    const escolhas = el('div', 'cup-escolhas');
    const sBase = secao('cup-s-base', 'Base', b.nomes.base);
    sBase.querySelector('.cup-rot')!.firstElementChild!.after(b.altaTrancada);
    sBase.append(grade('base', nivel, b));
    const sMistura = secao('cup-s-mistura', 'Mistura', b.nomes.mistura);
    sMistura.append(grade('mistura', nivel, b));
    const sExtra = secao('cup-s-extra', 'Extra', b.nomes.extra);
    sExtra.append(grade('extra', nivel, b));
    const sTam = secao('cup-s-tamanho', 'Tamanho', b.nomes.tamanho);
    sTam.append(grade('tamanho', nivel, b));
    escolhas.append(sBase, sMistura, sExtra, sTam, b.modaTexto);
    b.el.append(lado, escolhas);
    return b;
  }

  function mudarForca(f: number) {
    sel.forca = f;
    atualizarMontar();
  }
  function mudarPreco(d: number) {
    const [lo, hi] = precoFaixa(sel.base, sel.tamanho, sel.forca);
    sel.preco = Math.min(hi, Math.max(lo, sel.preco + d));
    sel.precoMexido = true;
    atualizarMontar();
  }

  function atualizarMontar() {
    const b = montar;
    if (!b || !ultimo) return;
    const { l, m, ocupado } = ultimo;
    const nivel = l.nivel ?? 1;
    const cad = cadAtual();
    const dj = djEscolhido() ? DJS[djEscolhido()! - 1] : null;
    for (const tipo of ['base', 'mistura', 'extra', 'tamanho'] as const) {
      b.botoes[tipo].forEach((bt, i) => {
        const on = sel[tipo] === i + 1;
        bt.setAttribute('aria-checked', String(on));
        bt.tabIndex = on ? 0 : -1;
      });
      b.nomes[tipo].textContent = LISTAS[tipo][sel[tipo] - 1].nome;
    }
    // em alta na semana (base e mistura da moda) e as bases que o DJ da sexta curte
    const selo = (bt: HTMLButtonElement, cls: string, texto: string, on: boolean) => {
      const s = bt.querySelector(`.${cls}`);
      if (on && !s) bt.append(el('span', cls, texto));
      if (!on) s?.remove();
    };
    b.botoes.base.forEach((bt, i) => {
      selo(bt, 'cup-alta', 'alta', i + 1 === m.moda.base);
      selo(bt, 'cup-dj-selo', 'DJ', !!dj && dj.bases.includes(i + 1));
      bt.setAttribute('aria-label', [BASES[i].nome, i + 1 === m.moda.base ? 'em alta' : '', dj?.bases.includes(i + 1) ? `${dj.nome} toca na sexta` : '']
        .filter(Boolean).join(', '));
    });
    b.botoes.mistura.forEach((bt, i) => {
      selo(bt, 'cup-alta', 'alta', i + 1 === m.moda.mistura);
      bt.setAttribute('aria-label', i + 1 === m.moda.mistura ? `${MISTURAS[i].nome}, em alta` : MISTURAS[i].nome);
    });
    const altaBase = BASES[m.moda.base - 1];
    b.altaTrancada.textContent = altaBase && !liberado('base', altaBase.id, nivel) ? `Em alta: ${altaBase.nome} (nív. ${altaBase.nivel})` : '';
    b.modaTexto.textContent = `Moda da semana: ${BASES[m.moda.base - 1].nome} + ${minusc(MISTURAS[m.moda.mistura - 1].nome)}. `
      + 'A nota conta a moda da semana em que o copão entra no cardápio.';
    // os tamanhos com a base e a mistura de agora
    const chave = `${sel.base},${sel.mistura},${sel.forca}`;
    if (b.chaveArte !== chave) {
      b.chaveArte = chave;
      b.tamanhos.forEach((c, i) => { try { pinta(c, recipiente(i + 1, sel.base, sel.mistura, sel.forca)); } catch { /* sem arte */ } });
    }
    // força: o que o caderninho já sabe dessa base
    b.forcaValor.textContent = String(sel.forca);
    const testes = cad.aguenta.get(sel.base);
    const ponto = pontoDescoberto(testes);
    b.forcas.forEach((bt, i) => {
      const f = i + 1;
      const on = sel.forca === f;
      bt.setAttribute('aria-checked', String(on));
      bt.tabIndex = on ? 0 : -1;
      const v = testes?.get(f);
      bt.classList.toggle('cup-f-testada', v !== undefined);
      bt.classList.toggle('cup-f-ponto', ponto === f);
      bt.dataset.aguenta = v === undefined ? '' : v >= 170 ? 'alto' : v >= 100 ? 'medio' : 'baixo';
      bt.setAttribute('aria-label', v === undefined ? `Força ${f}` : `Força ${f}: ${distanciaTexto(f, v, ponto)}`);
    });
    const t = forcaTestada(cad, sel.base, sel.forca);
    const nomeBase = BASES[sel.base - 1].nome;
    b.forcaInfo.textContent = t ? `${nomeBase} na ${sel.forca}: ${t.texto}${ponto !== null && sel.forca > ponto ? ` · PT ${(sel.forca - ponto) * 10}% por noite` : ''}.`
      : ponto !== null ? `Ponto ${daBase(sel.base)}: força ${ponto}${sel.forca > ponto ? ` · na ${sel.forca}, PT ${(sel.forca - ponto) * 10}% por noite` : ''}.`
        : testes?.size ? `${nomeBase}: testou ${[...testes.keys()].sort((x, y) => x - y).join(', ')}. O ponto ainda não fechou.`
          : `Nunca testou ${aBase(sel.base)}. A estreia conta quão longe do ponto ficou.`;
    // preço: a faixa válida pra base, o tamanho e a força; a referência; o lucro de cada venda
    const [lo, hi] = precoFaixa(sel.base, sel.tamanho, sel.forca);
    const ref = precoRef(sel.base, sel.tamanho, sel.forca);
    if (!sel.precoMexido) sel.preco = Math.round(ref);
    sel.preco = Math.min(hi, Math.max(lo, sel.preco));
    b.precoRange.min = String(lo);
    b.precoRange.max = String(hi);
    b.precoRange.value = String(sel.preco);
    b.precoRange.setAttribute('aria-valuetext', `${sel.preco} fichas`);
    b.precoValor.textContent = `${sel.preco} fichas`;
    b.precoMenos.disabled = sel.preco <= lo;
    b.precoMais.disabled = sel.preco >= hi;
    const lucro = lucroVenda(sel);
    b.precoInfo.replaceChildren(`De ${lo} a ${hi} · ref. ${inteiro(ref)} · `,
      Math.abs(lucro) < 0.05 ? el('span', undefined, 'sem lucro por venda')
        : el('span', lucro < 0 ? 'cup-prejuizo' : 'cup-fichas', `${lucro < 0 ? 'prejuízo' : 'lucro'} de ${fichasVenda(Math.abs(lucro))} por venda`));
    // nome e a prévia
    nome.placeholder = nomeSugerido(sel.base, sel.mistura, sel.extra, sel.tamanho, sel.n);
    const nomeAgora = nome.value.trim() || nome.placeholder;
    pinta(b.foto, fotoImagem(partesDe(sel)));
    b.foto.setAttribute('aria-label', `Prévia: ${descrever(sel)}`);
    b.placa.textContent = nomeAgora;
    // Pôr: o que impede primeiro, depois o que vai acontecer
    const avisos: string[] = [];
    let pode = !ocupado;
    if (m.cardapio.length >= m.vagas) {
      pode = false;
      avisos.push('O cardápio tá cheio: tira um copão antes.');
    }
    if (m.cardapio.some((c) => c.base === sel.base && c.mistura === sel.mistura && c.extra === sel.extra && c.tamanho === sel.tamanho)) {
      pode = false;
      avisos.push('Esse copão já tá no cardápio: troca a base, a mistura, o extra ou o tamanho.');
    } else if (m.cardapio.some((c) => c.base === sel.base && c.mistura === sel.mistura)) {
      avisos.push(`${nomeBase} com ${minusc(MISTURAS[sel.mistura - 1].nome)} já tá no cardápio: os dois vendem 30% menos.`);
    }
    if (lucro < 0) avisos.push('Nesse preço cada venda dá prejuízo.');
    const estreia = proximaNoite(agora());
    avisos.push(`Estreia ${quando(estreia, agora())} às 18h; a nota sai no fim da noite.`);
    avisosPor = avisos;
    aviso.textContent = avisos[0];
    aviso.classList.toggle('alerta', !pode && !ocupado);
    por.disabled = !pode;
    sortear.disabled = ocupado;
  }

  function abrirMontar() {
    if (!ultimo) return;
    vista = 'montar';
    idsAoMontar = new Set(ultimo.m.cardapio.map((c) => c.id));
    redesenhar();
    montar?.botoes.base.find((b) => b.tabIndex === 0)?.focus();
  }

  function desenharMontar(l: LugarEstado) {
    const nivel = l.nivel ?? 1;
    if (!montar || montar.nivel !== nivel) montar = montarMontar(nivel);
    for (const t of ['base', 'mistura', 'extra', 'tamanho'] as const) if (!liberado(t, sel[t], nivel)) sel[t] = 1;
    if (raiz.firstChild !== montar.el || raiz.childNodes.length !== 1) raiz.replaceChildren(montar.el);
    tick = null;
    atualizarMontar();
  }

  // ===================== DJs =====================
  function desenharDjs(l: LugarEstado, m: EstadoCup, ocupado: boolean) {
    const nivel = l.nivel ?? 1;
    const s = el('div', 'cup-djs');
    const cab = el('header', 'cup-djs-cab');
    const tit = el('div', 'cup-djs-tit');
    tit.append(el('h3', 'cup-titulo', 'Quem toca na sexta'),
      el('p', 'sub', sextaComecou(m) ? 'A sexta de hoje já começou com o DJ dela: a troca vale a partir da próxima sexta.'
        : 'Na sexta o movimento dobra, e o DJ dá +20% nos copões das bases que combinam com o som dele.'));
    const voltar = button('Voltar', 'btn compacto cup-djs-voltar', () => {
      vista = 'bar';
      redesenhar();
      raiz.querySelector<HTMLElement>('.cup-trocar-dj')?.focus();
    });
    voltar.dataset.foco = 'cup-djs-voltar';
    cab.append(tit, voltar);
    const g = el('div', 'cup-djs-grade');
    g.setAttribute('role', 'radiogroup');
    g.setAttribute('aria-label', 'DJ da sexta');
    const escolher = (id: number | null) => {
      vista = 'bar';
      if (id !== m.dj) a.acao('idle_cup_dj', { p_dj: id });
      redesenhar();
    };
    const opcoes: (number | null)[] = [...DJS.filter((d) => liberado('dj', d.id, nivel)).map((d) => d.id), null];
    const bts: HTMLButtonElement[] = [];
    opcoes.forEach((id, k) => {
      const d = id ? DJS[id - 1] : null;
      const bt = el('button', `cup-dj${id ? '' : ' nenhum'}`);
      bt.type = 'button';
      bt.setAttribute('role', 'radio');
      bt.dataset.foco = `cup-dj-${id ?? 0}`;
      const on = m.dj === id;
      bt.setAttribute('aria-checked', String(on));
      bt.tabIndex = on || (m.dj === null && k === 0) ? 0 : -1;
      bt.disabled = ocupado;
      const txt = el('span', 'cup-dj-txt');
      if (d) {
        txt.append(el('strong', 'cup-dj-nome', d.nome), el('span', 'cup-dj-estilo', d.estilo), el('span', 'cup-curte', `+20%: ${listaBases(d.bases)}`));
        bt.setAttribute('aria-label', `${d.nome}, ${d.estilo}. Mais 20% em copão de ${listaBases(d.bases)}`);
        dicas.ligar(bt, `cup-dj-${d.id}`, d.nome, () => dicaCupDj(d.id, nivelAtual(), ultimo?.m.dj === d.id));
      } else {
        txt.append(el('strong', 'cup-dj-nome', 'Sem DJ'), el('span', 'cup-curte', 'Só o movimento ×2 da sexta'));
        bt.setAttribute('aria-label', 'Sem DJ');
      }
      bt.append(retrato(id, 'cup-retrato-dj'), txt);
      bt.addEventListener('click', () => escolher(id));
      bt.addEventListener('keydown', (e) => {
        const passo = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
        if (!passo) return;
        e.preventDefault();
        bts[(k + passo + bts.length) % bts.length].focus();
      });
      bts.push(bt);
      g.append(bt);
    });
    const trancados = DJS.filter((d) => !liberado('dj', d.id, nivel));
    if (trancados.length) {
      const t = el('span', 'cup-dj trancado');
      t.tabIndex = 0;
      t.dataset.foco = 'cup-dj-trancados';
      t.setAttribute('role', 'note');
      t.setAttribute('aria-label', dicaCupTrancados('dj', nivel));
      const prox = trancados.reduce((x, y) => (y.nivel < x.nivel ? y : x));
      t.append(cadeado(), el('span', 'cup-niv', `nív. ${prox.nivel}`), el('span', 'cup-mais-n', `+${trancados.length}`));
      dicas.ligar(t, 'cup-dj-trancados', 'Trancado', () => dicaCupTrancados('dj', nivelAtual()));
      g.append(t);
    }
    s.append(cab, g);
    raiz.replaceChildren(s);
    tick = null;
  }

  // ===================== revelação =====================
  const aRevelar = (m: EstadoCup) => m.cardapio
    .filter((c) => c.revelado && c.nota !== null && (animando === `rev:${c.id}` || !jaViu(chaveRevelado(uid()), c.id)))
    .sort((x, y) => Date.parse(x.primeira_noite) - Date.parse(y.primeira_noite) || x.id - y.id);
  const chatPendente = (m: EstadoCup) => {
    const u = m.ultima_noite;
    return u && (chatManual || animando === `chat:${u.chat_seed}` || !jaViu(chaveNoite(uid()), u.chat_seed)) ? u : null;
  };

  function desenharRevelacao(c: CopaoCup, restam: number, m: EstadoCup) {
    animando = `rev:${c.id}`;
    const s = el('div', 'cup-revelacao');
    const palco = el('div', 'cup-rev-palco');
    parede(palco);
    palco.append(fotoCanvas('cup-foto-rev', partesDe(c), descrever(c)), el('p', 'cup-placa', c.nome));
    const painel = el('div', 'cup-rev-painel');
    const topo = el('div', 'cup-rev-topo');
    const nota = el('b', `cup-rev-nota ${nomeTier(c.nota!)}`, '0');
    nota.setAttribute('aria-label', `nota ${c.nota}`);
    topo.append(el('p', 'sub', 'Vendeu a primeira noite. A galera deu a nota:'), nota, el('span', 'cup-rev-de', 'de 999'));
    const partes = el('ul', 'cup-partes');
    const linhas = PARTES.map(([rot, k, max]) => {
      const v = (c[k] as number | null) ?? 0;
      const li = el('li', 'cup-parte');
      const barra = el('span', 'cup-parte-barra');
      const i = el('i');
      barra.append(i);
      const val = el('b', 'cup-parte-valor', `${v}`);
      li.append(el('span', 'cup-parte-rot', rot), barra, val, el('span', 'cup-parte-max', `/${max}`));
      li.setAttribute('aria-label', `${rot}: ${v} de ${max}`);
      partes.append(li);
      return { li, i, fr: Math.max(0, Math.min(1, v / max)) };
    });
    // os 3 pares (com o rótulo) e a força (quão longe do ponto)
    const rs = c.rotulos ?? rotulos(c.base, c.mistura, c.extra);
    const pares = el('ul', 'cup-rev-pares');
    const nomesPar: [string, string][] = [
      [BASES[c.base - 1].nome, minusc(MISTURAS[c.mistura - 1].nome)], [BASES[c.base - 1].nome, minusc(EXTRAS[c.extra - 1].nome)],
      [MISTURAS[c.mistura - 1].nome, minusc(EXTRAS[c.extra - 1].nome)],
    ];
    rs.forEach((r, k) => {
      const li = el('li', `cup-par rot-${r}`);
      li.append(el('i'), `${nomesPar[k][0]} + ${nomesPar[k][1]}: `, el('b', undefined, NOME_ROTULO[r]));
      pares.append(li);
    });
    const cad = cadAtual();
    const distancia = forcaTestada(cad, c.base, c.forca)?.texto ?? distanciaTexto(c.forca, c.aguenta ?? 0);
    const forca = el('p', 'cup-rev-forca',
      `Força ${c.forca}: ${distancia} ${daBase(c.base)}${c.chance_pt ? ` · chance de PT ${c.chance_pt}% por noite` : ''}.`);
    const moda = el('p', 'cup-info', 'A moda conta a semana em que o copão entrou no cardápio.');
    const proximo = restam > 1 ? 'Próximo copão' : chatPendente(m) ? 'Ver a noite' : 'Ver o bar';
    const ver = button(proximo, 'btn main cup-rev-ver', () => {
      gravarVisto(chaveRevelado(uid()), c.id);
      animando = null;
      redesenhar();
      raiz.querySelector<HTMLElement>('.cup-rev-ver, .cup-chat-ver, .cup-montar-vaga, .cup-tirar')?.focus();
    });
    ver.dataset.foco = 'cup-rev-ver';
    painel.append(topo, partes, pares, forca, moda, ver);
    s.append(palco, painel);
    raiz.replaceChildren(s);
    tick = null;

    const alvo = c.nota!;
    const final = () => {
      nota.textContent = String(alvo);
      for (const x of linhas) { x.li.classList.add('entrou'); x.i.style.width = `${x.fr * 100}%`; }
      s.classList.add('pronta');
    };
    if (movimentoReduzido()) {
      final();
      return;
    }
    let soma = 0;
    linhas.forEach((x, k) => {
      const ate = soma + ((c[PARTES[k][1]] as number | null) ?? 0);
      const de = soma;
      soma = ate;
      timers.push(setTimeout(() => { x.li.classList.add('entrou'); x.i.style.width = `${x.fr * 100}%`; }, REV_INICIO + k * PARTE_MS));
      for (let p = 1; p <= 6; p++) {
        timers.push(setTimeout(() => { nota.textContent = String(Math.round(de + ((ate - de) * p) / 6)); }, REV_INICIO + k * PARTE_MS + (PARTE_MS * p) / 6));
      }
    });
    timers.push(setTimeout(final, REV_INICIO + 4 * PARTE_MS + 100));
  }

  // ===================== chat da última noite =====================
  function desenharChat(u: UltimaNoite) {
    animando = `chat:${u.chat_seed}`;
    const s = el('div', 'cup-chat');
    const lado = el('aside', 'cup-chat-lado');
    const ini = Date.parse(u.inicio);
    const dj = u.sexta && u.dj ? DJS[u.dj - 1] : null;
    lado.append(el('h3', 'cup-titulo', tituloNoite(ini, agora())),
      el('p', 'sub', u.sexta ? (dj ? `Sexta, ${dj.nome} tocou ${dj.estilo}.` : 'Sexta, sem DJ.') : `Das 18h às 2h${u.copoes.length ? '' : ', com o cardápio vazio'}.`));
    const nums = el('dl', 'cup-chat-num');
    const par = (rot: string, valor: string, cls = '') => {
      const d = el('div', cls);
      d.append(el('dt', undefined, rot), el('dd', undefined, valor));
      nums.append(d);
    };
    par('vendidos', inteiro(Math.floor(u.vendas)));
    par('fichas', comSinal(u.fichas), u.fichas < 0 ? 'ruim' : 'bom');
    const g = galeraMudou(u.galera_delta);
    par('galera', g, g === 'igual' ? '' : u.galera_delta < 0 ? 'ruim' : 'bom');
    lado.append(nums);
    if (u.pt) lado.append(el('p', 'cup-pt-aviso', 'Deu PT: a galera caiu 15%.'));
    const lista = el('ol', 'cup-chat-copoes');
    for (const c of u.copoes) {
      const li = el('li', c.pt ? 'pt' : '');
      const meio = el('span', 'cup-chat-copao');
      meio.append(el('strong', undefined, c.nome), el('span', undefined, `${inteiro(Math.floor(c.vendidos))} vendidos · ${comSinal(c.fichas)} fichas${c.pt ? ' · PT' : ''}`));
      li.append(fotoCanvas('cup-foto-mini', partesDe(c), null), meio, el('b', `cup-mini-nota ${nomeTier(c.nota)}`, String(c.nota)));
      lista.append(li);
    }
    lado.append(lista);
    const ver = button('Abrir o bar', 'btn main cup-chat-ver', () => {
      gravarVisto(chaveNoite(uid()), u.chat_seed);
      chatManual = false;
      animando = null;
      redesenhar();
      raiz.querySelector<HTMLElement>('.cup-ver-chat')?.focus();
    });
    ver.dataset.foco = 'cup-chat-ver';
    lado.append(ver);

    const msgs = el('ol', 'cup-msgs');
    parede(msgs);
    msgs.setAttribute('aria-label', 'O chat da galera');
    const lis = chatDaNoite(u, uid()).map((x, k) => {
      const lado2 = k % 2 ? 'dir' : 'esq';
      const li = el('li', `cup-msg ${x.tipo} ${lado2}`);
      const c = cauda(x.tipo, lado2);
      if (c) li.style.setProperty('--cauda', `url(${c})`);
      li.append(el('span', 'cup-autor', x.autor), el('p', undefined, x.texto));
      msgs.append(li);
      return li;
    });
    s.append(lado, msgs);
    raiz.replaceChildren(s);
    tick = null;
    if (movimentoReduzido()) {
      for (const li of lis) li.classList.add('entrou');
      return;
    }
    lis.forEach((li, k) => timers.push(setTimeout(() => li.classList.add('entrou'), 200 + k * MSG_MS)));
  }

  // ===================== caderninho inteiro (aberto pela faixa) =====================
  const atualDe = (l: LugarEstado, m: EstadoCup, ocupado: boolean): Atual => ({ a, dicas, l, m, ocupado, abrirCaderno });
  function abrirCaderno() {
    if (!ultimo) return;
    vendoCaderno = true;
    redesenhar();
    raiz.querySelector<HTMLButtonElement>('.cup-fechar-caderno')?.focus();
  }
  function desenharCaderno(l: LugarEstado, m: EstadoCup) {
    const s = el('div', 'cup-caderno');
    const cab = el('header', 'cup-caderno-cab');
    const tit = el('div', 'cup-caderno-tit');
    tit.append(el('h3', 'cup-titulo', 'Caderninho'),
      el('p', 'sub', 'Os pares que já estrearam e quão longe do ponto ficou cada força testada.'));
    const voltar = button('Voltar', 'btn compacto cup-fechar-caderno', () => {
      vendoCaderno = false;
      redesenhar();
      document.querySelector<HTMLElement>('[data-foco="cup-abrir-caderno"]')?.focus();
    });
    voltar.dataset.foco = 'cup-fechar-caderno';
    cab.append(tit, voltar);
    s.append(cab, criarCadernoCompleto(l.caderninho, atualDe(l, m, ultimo?.ocupado ?? false)));
    raiz.replaceChildren(s);
    tick = null;
  }

  // ===================== o desenho =====================
  function redesenhar() {
    if (ultimo) desenhar(ultimo.l, ultimo.m, ultimo.ocupado);
  }
  function desenhar(l: LugarEstado, m: EstadoCup, ocupado: boolean) {
    // deu certo o Pôr (apareceu um copão novo no cardápio): volta pro bar e o próximo nome começa do zero
    if (vista === 'montar' && idsAoMontar && m.cardapio.some((c) => !idsAoMontar!.has(c.id))) {
      vista = 'bar';
      idsAoMontar = null;
      nome.value = '';
      sel.n++;
      sel.precoMexido = false;
    }
    if (tirando !== null && !m.cardapio.some((c) => c.id === tirando)) tirando = null;
    const revs = vista === 'bar' ? aRevelar(m) : [];
    const chat = vista === 'bar' && !revs.length ? chatPendente(m) : null;
    const novo: Estado = vendoCaderno ? 'caderno' : revs.length ? 'revelacao' : chat ? 'chat' : vista;
    // a revelação ou o chat que está passando não recomeça
    if (novo === 'revelacao' && estado === 'revelacao' && animando === `rev:${revs[0].id}`) return;
    if (novo === 'chat' && estado === 'chat' && animando === `chat:${chat!.chat_seed}`) return;
    const chave = foco.guardar();
    limparTimers();
    if (novo !== 'revelacao' && novo !== 'chat') animando = null;
    estado = novo;
    raiz.dataset.estado = novo;
    if (novo === 'caderno') desenharCaderno(l, m);
    else if (novo === 'revelacao') desenharRevelacao(revs[0], revs.length, m);
    else if (novo === 'chat') desenharChat(chat!);
    else if (novo === 'montar') desenharMontar(l);
    else if (novo === 'djs') desenharDjs(l, m, ocupado);
    else desenharBar(l, m, ocupado);
    foco.devolver(chave);
    garantirIntervalo();
  }

  function renderizar(l: LugarEstado, ocupado: boolean, agoraMs: number) {
    relogio = agoraMs - Date.now();
    servidorMs = Date.parse(l.server_now) || agoraMs;
    const m = l.mecanica as EstadoCup | null;
    if (!m) {
      ultimo = null;
      estado = 'carregando';
      raiz.dataset.estado = estado;
      raiz.replaceChildren(el('p', 'vazio', 'Abrindo o bar…'));
      return;
    }
    ultimo = { l, m, ocupado };
    avisar(atualDe(l, m, ocupado));
    desenhar(l, m, ocupado);
  }

  return { elemento: raiz, renderizar };
}

// ===================== caderninho =====================
type Matriz = { tipo: TipoPar; titulo: string; linhas: readonly { id: number; nome: string }[]; colunas: readonly { id: number; nome: string }[];
  abrevL: readonly string[]; abrevC: readonly string[] };

function matrizes(nivel: number): Matriz[] {
  const b = BASES.filter((x) => liberado('base', x.id, nivel));
  const mi = MISTURAS.filter((x) => liberado('mistura', x.id, nivel));
  const e = EXTRAS.filter((x) => liberado('extra', x.id, nivel));
  return [
    { tipo: 0, titulo: 'Base × mistura', linhas: b, colunas: mi, abrevL: ABREV_BASE, abrevC: ABREV_MISTURA },
    { tipo: 1, titulo: 'Base × extra', linhas: b, colunas: e, abrevL: ABREV_BASE, abrevC: ABREV_EXTRA },
    { tipo: 2, titulo: 'Mistura × extra', linhas: mi, colunas: e, abrevL: ABREV_MISTURA, abrevC: ABREV_EXTRA },
  ];
}

/** O caderninho inteiro (no miolo): as 3 tabelas de pares do que liberou com a cor do rótulo e, por base, as forças
 *  testadas com quão longe do ponto cada uma ficou (e o ponto, quando já fecha). */
function criarCadernoCompleto(itens: readonly NotaCaderninho[], atual: Atual | null): HTMLElement {
  const cad = cadernoCup(itens);
  const nivel = atual?.l.nivel ?? 1;
  const raiz = el('div', 'cup-cad');
  const tabelas = el('div', 'cup-tabelas');
  for (const mt of matrizes(nivel)) {
    const fig = el('figure', 'cup-tabela-fig');
    const tabela = el('table', 'cup-tabela');
    tabela.setAttribute('aria-label', mt.titulo);
    const cab = el('tr');
    const canto = el('th');
    canto.setAttribute('aria-hidden', 'true');
    cab.append(canto);
    for (const c of mt.colunas) {
      const th = el('th', undefined, mt.abrevC[c.id - 1]);
      th.scope = 'col';
      th.setAttribute('aria-label', c.nome);
      cab.append(th);
    }
    const thead = el('thead');
    thead.append(cab);
    const tbody = el('tbody');
    for (const r of mt.linhas) {
      const tr = el('tr');
      const th = el('th', undefined, mt.abrevL[r.id - 1]);
      th.scope = 'row';
      th.setAttribute('aria-label', r.nome);
      tr.append(th);
      for (const c of mt.colunas) {
        const rot = cad.pares.get(chavePar(mt.tipo, r.id, c.id));
        const td = el('td', `cup-c ${rot === undefined ? 'vazio' : `rot-${rot}`}`);
        const texto = rot === undefined ? 'ainda não testou' : `combinação ${NOME_ROTULO[rot]}`;
        td.setAttribute('aria-label', `${r.nome} com ${minusc(c.nome)}: ${texto}`);
        atual?.dicas.ligar(td, `cup-cad-${mt.tipo}-${r.id}-${c.id}`, `${r.nome} + ${minusc(c.nome)}`,
          () => (rot === undefined ? 'Ainda não testou.' : `Combinação ${NOME_ROTULO[rot]}${rot === 4 ? '!' : '.'}`));
        tr.append(td);
      }
      tbody.append(tr);
    }
    tabela.append(thead, tbody);
    fig.append(el('figcaption', 'cup-rot', mt.titulo), tabela);
    tabelas.append(fig);
  }
  const legenda = el('p', 'cup-legenda');
  legenda.setAttribute('aria-hidden', 'true');
  NOME_ROTULO.forEach((r, k) => {
    const sp = el('span');
    sp.append(el('i', `rot-${k}`), r);
    legenda.append(sp);
  });
  const nt = el('span');
  nt.append(el('i', 'vazio'), 'não testou');
  legenda.append(nt);

  const pontos = el('section', 'cup-pontos');
  const tp = el('h4', 'cup-rot');
  tp.append(el('span', undefined, 'Força que aguenta, por base'));
  pontos.append(tp);
  const bases = BASES.filter((b) => liberado('base', b.id, nivel));
  const testadas = bases.filter((b) => cad.aguenta.get(b.id)?.size);
  const ul = el('ul', 'cup-pontos-lista');
  for (const b of testadas) {
    const testes = cad.aguenta.get(b.id)!;
    const ponto = pontoDescoberto(testes);
    const li = el('li', 'cup-ponto-item');
    li.append(el('span', 'cup-ponto-base', b.nome));
    const fs = el('span', 'cup-ponto-forcas');
    for (const [f, v] of [...testes.entries()].sort((x, y) => x[0] - y[0])) {
      const txt = distanciaTexto(f, v, ponto);
      const chip = el('span', `cup-ponto-f ${v >= 170 ? 'alto' : v >= 100 ? 'medio' : 'baixo'}`);
      chip.append(el('b', undefined, String(f)), el('span', undefined, distanciaCurta(f, v, ponto)));
      chip.setAttribute('aria-label', `Força ${f}: ${txt}, aguenta ${v}`);
      atual?.dicas.ligar(chip, `cup-ponto-${b.id}-${f}`, `${b.nome} na força ${f}`, () => `${txt.charAt(0).toUpperCase()}${txt.slice(1)}. Aguenta ${v} de 199.`);
      fs.append(chip);
    }
    li.append(fs, el('span', `cup-ponto-res${ponto !== null ? ' achou' : ''}`, ponto !== null ? `ponto ${ponto}` : 'falta testar'));
    ul.append(li);
  }
  if (testadas.length) {
    pontos.append(ul, el('p', 'cup-info cup-ponto-legenda', 'Força e quão longe do ponto: 0 no ponto · +1 acima · −2 abaixo · +3/−4 um dos dois · longe = 4 ou mais acima, 5 ou mais abaixo.'));
  }
  const nunca = bases.filter((b) => !testadas.includes(b));
  if (nunca.length) {
    pontos.append(el('p', 'cup-info cup-ponto-nunca', testadas.length ? `Ainda não testou: ${listaBases(nunca.map((b) => b.id))}.`
      : 'Nenhuma base testada ainda: a estreia de cada copão conta quão longe do ponto a força ficou.'));
  }
  raiz.append(tabelas, legenda, pontos);
  return raiz;
}

/** O caderninho na faixa da moldura: o resumo em números e o botão que abre o caderninho inteiro no miolo. */
function criarResumoCaderninho(itens: readonly NotaCaderninho[], atual: Atual | null): HTMLElement {
  const cad = cadernoCup(itens);
  const nivel = atual?.l.nivel ?? 1;
  const ms = matrizes(nivel);
  const total = ms.reduce((s, x) => s + x.linhas.length * x.colunas.length, 0);
  const rots: number[] = [];
  for (const mt of ms) for (const r of mt.linhas) for (const c of mt.colunas) {
    const v = cad.pares.get(chavePar(mt.tipo, r.id, c.id));
    if (v !== undefined) rots.push(v);
  }
  const raiz = el('div', 'cup-cad-resumo');
  const linha = el('p', 'cup-resumo-num');
  linha.append(el('b', undefined, String(rots.length)), ` testados de ${total} pares liberados`);
  const contas = el('p', 'cup-resumo-rot');
  for (let r = 4; r >= 0; r--) {
    const n = rots.filter((x) => x === r).length;
    if (!n) continue;
    const sp = el('span');
    sp.append(el('i', `rot-${r}`), `${n} ${NOME_ROTULO[r]}${n === 1 || r === 2 ? '' : 's'}`);
    contas.append(sp);
  }
  const testadas = [...cad.aguenta.keys()].filter((b) => liberado('base', b, nivel));
  const achou = testadas.filter((b) => pontoDescoberto(cad.aguenta.get(b)) !== null).length;
  const pontos = el('p', 'cup-resumo-ponto', testadas.length
    ? `Ponto de força: ${achou} de ${testadas.length} ${testadas.length === 1 ? 'base testada' : 'bases testadas'}`
    : 'Ponto de força: estreia um copão pra começar a descobrir.');
  const abrir = button('Abrir o caderninho', 'btn compacto cup-abrir-caderno', () => atual?.abrirCaderno());
  abrir.dataset.foco = 'cup-abrir-caderno';
  abrir.disabled = !atual;
  raiz.append(linha);
  if (contas.childNodes.length) raiz.append(contas);
  raiz.append(pontos, abrir);
  return raiz;
}

/** O copão como mecânica da moldura (uma por app; os testes criam a delas). */
export function criarCopao(): Mecanica {
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

export const COPAO = criarCopao();
