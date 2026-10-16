// Eventos de era na tela (14/10): o desenho de pixel de cada um com o botão dele, um por vez. Clicar chama `aoPegar`
// (o banco confere) com o ponto onde a coisa estava (o texto sobe dali). O Jogo do Brasil é diferente: a bola pula de
// ponto em ponto (a cada 1,5 s e a cada gol) e cada clique é gol; manda os gols no 7º ou quando a janela acaba (sem
// gol, não manda nada). Eras 6–7: o Lixo espacial é igual com 3 destroços atravessando (um por vez) e o Houston é uma
// caixa com botão que pisca a cena em vermelho enquanto está na tela.
import { JANELA_EVENTO_S, MAX_DESVIOS, MAX_GOLS, NOME_EVENTO_ERA, type TipoEventoEra } from './eventosEra';

const PALETA: Record<string, string> = {
  K: '#1E1B2E', B: '#5A3A1E', S: '#D9A066', H: '#FF5A7A', R: '#E0454B', W: '#F4F1EA', O: '#F07A2A', Q: '#B8501A',
  C: '#5AA9E6', A: '#2A5BD7', N: '#8A8796',
};
// 12 × 12, uma letra por pixel ('.' = vazio).
const ICONES: Record<TipoEventoEra, readonly string[]> = {
  // a mãe de avental
  1: ['....BBBB....', '...BBBBBB...', '..BBSSSSBB..', '..BSKSSKSB..', '..BSSSSSSB..', '...SSHHSS...',
      '....SSSS....', '...RRRRRR...', '..RRWWWWRR..', '..RRWWWWRR..', '..RRWWWWRR..', '...RR..RR...'],
  // a caixa laranja com a fita
  2: ['....W..W....', '.....WW.....', '.OOOOWWOOOO.', '.QQQQWWQQQQ.', '.OOOOWWOOOO.', '.OOOOWWOOOO.',
      '.OOOWWWWOOO.', '.OOOOWWOOOO.', '.OOOOWWOOOO.', '.OOOOWWOOOO.', '.QQQQQQQQQQ.', '............'],
  // a call com 6 quadradinhos e o botão vermelho
  3: ['KKKKKKKKKKKK', 'KCCCKCCCKCCK', 'KCSCKCSCKSCK', 'KCCCKCCCKCCK', 'KKKKKKKKKKKK', 'KCCCKCCCKCCK',
      'KCSCKCSCKSCK', 'KCCCKCCCKCCK', 'KKKKKKKKKKKK', 'KRRRRWWRRRRK', 'KKKKKKKKKKKK', '............'],
  // o monitor com a tela azul e a carinha triste
  4: ['KKKKKKKKKKKK', 'KAAAAAAAAAAK', 'KAWAAWWWAAAK', 'KAAAWAAAAAAK', 'KAWAWAAAAAAK', 'KAAAAWWWAAAK',
      'KAAAAAAAAAAK', 'KAWWWWWWWAAK', 'KAAAAAAAAAAK', 'KKKKKKKKKKKK', '....KKKK....', '..KKKKKKKK..'],
  // a bola: branca com os gomos pretos
  5: ['...KKKKKK...', '..KWWKKWWK..', '.KWWWWWWWWK.', 'KWWWWKKWWWWK', 'KKWWKKKKWWKK', 'KKWWKKKKWWKK',
      'KWWWWKKWWWWK', 'KWWWWWWWWWWK', 'KWKKWWWWKKWK', '.KKKWWWWKKK.', '..KWWWWWWK..', '...KKKKKK...'],
  // o destroço: pedaço de satélite com os painéis azuis, rodando (eras 6–7)
  6: ['............', '.KKKK.......', '.KCAK..K....', '.KACKKKKK...', '.KCAKNWNK...', '.KKKKNNNKKK.',
      '.....KNNKCK.', '...K.KKKKAK.', '.........KK.', '..K.........', '.......K....', '............'],
  // o alarme: a sirene vermelha com a luz saindo
  7: ['............', 'O....WW....O', '.O..KKKK..O.', '...KRRWRK...', '..KRRRHRRK..', 'OOKRRRHRRKOO',
      '..KRRRRRRK..', '.KKKKKKKKKK.', '.KNNNNNNNNK.', '.KKKKKKKKKK.', '............', '............'],
};
const BOTAO: Record<1 | 2 | 3 | 4 | 7, string> = {
  1: 'Já vou!', 2: 'Abrir pacote', 3: 'Sair da call', 4: 'Reiniciar', 7: 'Consertar com silver tape',
};
const BALAO: Record<1 | 2 | 3 | 4 | 7, string> = {
  1: 'Desce pra almoçar!', 2: 'Seu pacote chegou', 3: 'Reunião: alinhamento do alinhamento', 4: 'Seu PC encontrou um problema',
  7: 'Houston, temos um problema',
};

const NS = 'http://www.w3.org/2000/svg';
function icone(tipo: TipoEventoEra): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('class', 'icone-evento');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  const porCor = new Map<string, string>();
  ICONES[tipo].forEach((linha, y) => [...linha].forEach((c, x) => {
    if (c !== '.') porCor.set(c, `${porCor.get(c) ?? ''}M${x} ${y}h1v1h-1z`);
  }));
  for (const [c, d] of porCor) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', PALETA[c]);
    svg.append(p);
  }
  return svg;
}

type Ponto = { x: number; y: number };
export type OpcoesEventoEra = {
  /** `pos` = onde a coisa estava (fração da tela; o texto sobe dali); `gols` = os gols do Jogo do Brasil ou os desvios do
   *  Lixo espacial; `tipo` = o que a página mostrou (o banco aceita o da era anterior: a era pode ter mudado no meio) */
  aoPegar(seg: number, gols: number, pos: Ponto, tipo: TipoEventoEra): void;
  /** liga a caixinha de informação (mouse/teclado) no elemento */
  dica(el: HTMLElement, chave: string, tipo: TipoEventoEra): void;
  /** onde fica (fração da tela); `i` = o pulo da bola ou o destroço */
  posicao(seg: number, i: number): Ponto;
  /** cada gol do Jogo do Brasil (o som do gol); `gols` = quantos já */
  aoGol?(gols: number): void;
  /** cada destroço desviado no Lixo espacial (o "tum"); `desvios` = quantos já */
  aoDesvio?(desvios: number): void;
  /** clicou no botão da caixa (Abrir pacote, Sair da call, Consertar…): o som da ação */
  aoBotao?(tipo: 1 | 2 | 3 | 4 | 7): void;
  /** o que pisca em vermelho enquanto o Houston está na tela (a cena) */
  alarmeEm?: HTMLElement;
};
/** Quantos pulos de 1,5 s a bola já deu, `agoraMs` depois do segundo `seg`. */
/** Bola acima disto (fração da tela, do topo): o placar vai pra baixo dela, senão sairia da tela/cobriria o topo. */
const PLACAR_EMBAIXO_Y = 0.25;
const passoDe = (seg: number, agoraMs: number) => Math.max(0, Math.floor((agoraMs - seg * 1000) / 1500));
/** Lixo espacial: cada destroço atravessa em um terço da janela, um depois do outro. */
export const PASSO_DESTROCO_MS = (JANELA_EVENTO_S[6] * 1000) / MAX_DESVIOS;
const destrocoDe = (seg: number, agoraMs: number) => Math.max(0, Math.floor((agoraMs - seg * 1000) / PASSO_DESTROCO_MS));
/** Folga da caixa até a borda da tela (px). */
const MARGEM_TELA = 8;
/** O centro (px) de uma caixa `tam` empurrado pra ela caber inteira na tela, com `margem` de folga; maior que a
 *  tela num eixo, fica no meio dele. */
export function prenderNaTela(centro: Ponto, tam: { w: number; h: number }, tela: { w: number; h: number }, margem = MARGEM_TELA): Ponto {
  const eixo = (c: number, t: number, total: number) => {
    const min = margem + t / 2;
    const max = total - margem - t / 2;
    return min > max ? total / 2 : Math.min(max, Math.max(min, c));
  };
  return { x: eixo(centro.x, tam.w, tela.w), y: eixo(centro.y, tam.h, tela.h) };
}

export function criarEventoEraTela(raiz: HTMLElement, o: OpcoesEventoEra) {
  const camada = document.createElement('div');
  camada.className = 'eventos-era';
  raiz.append(camada);
  // a bola fica no pulo `passo + gols`: anda a cada 1,5 s e a cada gol
  // `base` = o ponto sorteado (a caixa volta a ele e é presa de novo quando a tela muda de tamanho)
  let atual: { seg: number; tipo: TipoEventoEra; ateMs: number; caixa: HTMLElement; gols: number; passo: number; pos: Ponto; base?: Ponto } | null = null;
  const encerrados = new Set<number>();
  window.addEventListener('resize', () => {
    if (atual?.base) atual.pos = posicionarCaixa(atual.caixa, atual.base);
  });

  function encerrar(enviar: boolean) {
    if (!atual) return;
    const a = atual;
    atual = null;
    a.caixa.remove();
    encerrados.add(a.seg);
    if (a.tipo === 7) o.alarmeEm?.classList.remove('alarme');
    const conta = a.tipo === 5 || a.tipo === 6; // Jogo do Brasil e Lixo mandam quantos (sem nenhum, nada)
    if (enviar && (!conta || a.gols > 0)) o.aoPegar(a.seg, conta ? a.gols : 0, a.pos, a.tipo);
  }
  function posicionar(el: HTMLElement, p: Ponto) {
    el.style.left = `${Math.round(p.x * 100)}%`;
    el.style.top = `${Math.round(p.y * 100)}%`;
  }
  /** A caixa no ponto sorteado, empurrada pra dentro da tela se a borda passar (a bola e o placar têm o clamp do CSS;
   *  a tela azul é a faixa inteira). Devolve onde ela ficou (fração da tela). */
  function posicionarCaixa(el: HTMLElement, p: Ponto): Ponto {
    posicionar(el, p);
    // tudo em px da camada (no PC a .app tem zoom: o left em px é antes do zoom, igual ao offsetWidth/clientWidth);
    // a folga de 8 px cobre o balanço de ±3°
    const W = camada.clientWidth;
    const H = camada.clientHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!W || !H || !w || !h) return p;
    const centro = { x: (Math.round(p.x * 100) / 100) * W, y: (Math.round(p.y * 100) / 100) * H };
    const c = prenderNaTela(centro, { w, h }, { w: W, h: H });
    if (c.x === centro.x && c.y === centro.y) return p;
    el.style.left = `${Math.round(c.x)}px`;
    el.style.top = `${Math.round(c.y)}px`;
    return { x: Math.round(c.x) / W, y: Math.round(c.y) / H };
  }
  /** A bola e o placar dela (em cima da bola; embaixo quando a bola está perto do topo; o CSS segura nas laterais). */
  function moverBola(caixa: HTMLElement, p: Ponto) {
    const bola = caixa.querySelector<HTMLElement>('.evento-bola');
    const placar = caixa.querySelector<HTMLElement>('.evento-placar');
    if (bola) posicionar(bola, p);
    if (placar) {
      placar.style.setProperty('--x', `${Math.round(p.x * 100)}%`);
      placar.style.setProperty('--y', `${Math.round(p.y * 100)}%`);
      placar.classList.toggle('embaixo', p.y < PLACAR_EMBAIXO_Y);
    }
  }
  /** A bola vai pro pulo `passo + gols`. */
  function pularBola() {
    if (!atual || atual.tipo !== 5) return;
    atual.pos = o.posicao(atual.seg, atual.passo + atual.gols);
    moverBola(atual.caixa, atual.pos);
  }
  /** "Lixo espacial · 1 de 3" */
  function contarDesvios(caixa: HTMLElement, n: number) {
    const placar = caixa.querySelector('.evento-placar');
    if (placar) placar.textContent = `${NOME_EVENTO_ERA[6]} · ${n} de ${MAX_DESVIOS}`;
  }
  /** O destroço `i` (0 a 2): entra pela esquerda numa altura sorteada e atravessa em um terço da janela (o CSS anda; o
   *  atraso negativo acerta quem voltou pra aba no meio). Cada um conta uma vez: clicou, ele sai. */
  function lancarDestroco(caixa: HTMLElement, seg: number, i: number, agoraMs: number) {
    caixa.querySelector('.evento-destroco')?.remove();
    if (i >= MAX_DESVIOS) return;
    const p = o.posicao(seg, i);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'evento-destroco';
    b.setAttribute('aria-label', 'Desviar do destroço');
    b.style.top = `${Math.round(p.y * 100)}%`;
    b.style.setProperty('--passo', `${Math.round(PASSO_DESTROCO_MS)}ms`);
    b.style.setProperty('--ja', `-${Math.max(0, Math.round(agoraMs - seg * 1000 - i * PASSO_DESTROCO_MS))}ms`);
    b.append(icone(6));
    b.addEventListener('click', () => {
      if (!atual || atual.seg !== seg || atual.passo !== i) return;
      atual.gols++;
      atual.pos = { x: 0.5, y: p.y };
      caixa.classList.add('travado'); // do 1º desvio até acabar, a tela atrás segura os cliques
      contarDesvios(caixa, atual.gols);
      o.aoDesvio?.(atual.gols);
      b.remove();
      if (atual.gols >= MAX_DESVIOS) encerrar(true);
    });
    caixa.append(b);
    o.dica(b, `evento-${seg}-${i}`, 6);
  }

  return {
    mostrar(e: { seg: number; tipo: TipoEventoEra; agoraMs: number }) {
      const ateMs = (e.seg + JANELA_EVENTO_S[e.tipo]) * 1000;
      if (atual || encerrados.has(e.seg) || e.agoraMs >= ateMs) return;
      const caixa = document.createElement('div');
      caixa.className = `evento-era evento-era-${e.tipo}`;
      caixa.style.setProperty('--janela', `${JANELA_EVENTO_S[e.tipo]}s`);
      caixa.style.setProperty('--ja', `-${Math.max(0, Math.round((e.agoraMs - e.seg * 1000) / 1000))}s`);
      const passo = e.tipo === 5 ? passoDe(e.seg, e.agoraMs) : e.tipo === 6 ? destrocoDe(e.seg, e.agoraMs) : 0;
      const pos = o.posicao(e.seg, passo);
      // a tela azul é a faixa inteira no meio da tela (o CSS força o left em 50%)
      atual = { seg: e.seg, tipo: e.tipo, ateMs, caixa, gols: 0, passo, pos: e.tipo === 4 ? { x: 0.5, y: pos.y } : pos };
      if (e.tipo === 5) {
        const placar = document.createElement('div');
        placar.className = 'evento-placar';
        const contar = (gols: number) => { placar.textContent = `${NOME_EVENTO_ERA[5]} · ${gols} de ${MAX_GOLS}`; };
        contar(0);
        const bola = document.createElement('button');
        bola.type = 'button';
        bola.className = 'evento-bola';
        bola.setAttribute('aria-label', 'Chutar pro gol');
        bola.append(icone(5));
        bola.addEventListener('click', () => {
          if (!atual || atual.seg !== e.seg) return;
          atual.gols++;
          // do 1º gol até acabar, a caixa (a tela inteira) segura os cliques: errar a bola não compra gerador sem querer
          caixa.classList.add('travado');
          contar(atual.gols);
          o.aoGol?.(atual.gols);
          if (atual.gols >= MAX_GOLS) encerrar(true); // o 7º: o texto sobe onde a bola levou o chute
          else pularBola();
        });
        caixa.append(placar, bola);
        moverBola(caixa, pos);
        o.dica(bola, `evento-${e.seg}`, e.tipo);
      } else if (e.tipo === 6) {
        // Lixo espacial: os 3 destroços atravessam a tela um de cada vez; cada clique num é um desvio
        const placar = document.createElement('div');
        placar.className = 'evento-placar lixo-placar';
        caixa.append(placar);
        contarDesvios(caixa, 0);
        lancarDestroco(caixa, e.seg, passo, e.agoraMs);
      } else {
        const t = e.tipo;
        const balao = document.createElement('div');
        balao.className = 'evento-balao';
        balao.textContent = BALAO[t];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn';
        b.textContent = BOTAO[t];
        b.setAttribute('aria-label', `${BOTAO[t]} (${NOME_EVENTO_ERA[t]})`);
        b.addEventListener('click', () => {
          if (atual?.seg !== e.seg) return;
          o.aoBotao?.(t);
          encerrar(true);
        });
        caixa.append(icone(t), balao, b);
        if (t === 7) o.alarmeEm?.classList.add('alarme'); // Houston: a cena pisca em vermelho
        posicionar(caixa, atual.pos);
        o.dica(caixa, `evento-${e.seg}`, t);
      }
      camada.append(caixa);
      if (e.tipo !== 4 && e.tipo !== 5 && e.tipo !== 6) {
        atual.base = pos;
        atual.pos = posicionarCaixa(caixa, pos); // já na tela: dá pra medir
      }
    },
    /** A cada passo da página: a bola pula a cada 1,5 s; passou da janela, encerra (o Jogo do Brasil manda os gols). */
    tick(agoraMs: number) {
      if (!atual) return;
      if (agoraMs >= atual.ateMs) {
        encerrar(atual.tipo === 5 || atual.tipo === 6);
        return;
      }
      if (atual.tipo === 5) {
        const passo = passoDe(atual.seg, agoraMs);
        if (passo > atual.passo) {
          atual.passo = passo;
          pularBola();
        }
      }
      if (atual.tipo === 6) {
        const i = destrocoDe(atual.seg, agoraMs);
        if (i > atual.passo) {
          atual.passo = i;
          lancarDestroco(atual.caixa, atual.seg, i, agoraMs);
        }
      }
    },
    ativo: () => atual !== null,
  };
}
