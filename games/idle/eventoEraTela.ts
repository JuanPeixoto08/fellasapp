// Eventos de era na tela (14/10): o desenho de pixel de cada um com o botão dele, um por vez. Clicar chama `aoPegar`
// (o banco confere) com o ponto onde a coisa estava (o texto sobe dali). O Jogo do Brasil é diferente: a bola pula de
// ponto em ponto (a cada 1,5 s e a cada gol) e cada clique é gol; manda os gols no 7º ou quando a janela acaba (sem
// gol, não manda nada).
import { JANELA_EVENTO_S, MAX_GOLS, NOME_EVENTO_ERA, type TipoEventoEra } from './eventosEra';

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
};
const BOTAO: Record<1 | 2 | 3 | 4, string> = { 1: 'Já vou!', 2: 'Abrir pacote', 3: 'Sair da call', 4: 'Reiniciar' };
const BALAO: Record<1 | 2 | 3 | 4, string> = {
  1: 'Desce pra almoçar!', 2: 'Seu pacote chegou', 3: 'Reunião: alinhamento do alinhamento', 4: 'Seu PC encontrou um problema',
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
  /** `pos` = onde a coisa estava (fração da tela): a tela azul é a faixa no meio, a bola é o último pulo dela */
  aoPegar(seg: number, gols: number, pos: Ponto): void;
  /** liga a caixinha de informação (mouse/teclado) no elemento */
  dica(el: HTMLElement, chave: string, tipo: TipoEventoEra): void;
  /** onde fica (fração da tela); `i` = o pulo da bola */
  posicao(seg: number, i: number): Ponto;
};
/** Quantos pulos de 1,5 s a bola já deu, `agoraMs` depois do segundo `seg`. */
/** Bola acima disto (fração da tela, do topo): o placar vai pra baixo dela, senão sairia da tela/cobriria o topo. */
const PLACAR_EMBAIXO_Y = 0.25;
const passoDe = (seg: number, agoraMs: number) => Math.max(0, Math.floor((agoraMs - seg * 1000) / 1500));

export function criarEventoEraTela(raiz: HTMLElement, o: OpcoesEventoEra) {
  const camada = document.createElement('div');
  camada.className = 'eventos-era';
  raiz.append(camada);
  // a bola fica no pulo `passo + gols`: anda a cada 1,5 s e a cada gol
  let atual: { seg: number; tipo: TipoEventoEra; ateMs: number; caixa: HTMLElement; gols: number; passo: number; pos: Ponto } | null = null;
  const encerrados = new Set<number>();

  function encerrar(enviar: boolean) {
    if (!atual) return;
    const a = atual;
    atual = null;
    a.caixa.remove();
    encerrados.add(a.seg);
    if (enviar && (a.tipo !== 5 || a.gols > 0)) o.aoPegar(a.seg, a.tipo === 5 ? a.gols : 0, a.pos);
  }
  function posicionar(el: HTMLElement, p: Ponto) {
    el.style.left = `${Math.round(p.x * 100)}%`;
    el.style.top = `${Math.round(p.y * 100)}%`;
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

  return {
    mostrar(e: { seg: number; tipo: TipoEventoEra; agoraMs: number }) {
      const ateMs = (e.seg + JANELA_EVENTO_S[e.tipo]) * 1000;
      if (atual || encerrados.has(e.seg) || e.agoraMs >= ateMs) return;
      const caixa = document.createElement('div');
      caixa.className = `evento-era evento-era-${e.tipo}`;
      caixa.style.setProperty('--janela', `${JANELA_EVENTO_S[e.tipo]}s`);
      caixa.style.setProperty('--ja', `-${Math.max(0, Math.round((e.agoraMs - e.seg * 1000) / 1000))}s`);
      const passo = e.tipo === 5 ? passoDe(e.seg, e.agoraMs) : 0;
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
          contar(atual.gols);
          if (atual.gols >= MAX_GOLS) encerrar(true); // o 7º: o texto sobe onde a bola levou o chute
          else pularBola();
        });
        caixa.append(placar, bola);
        moverBola(caixa, pos);
        o.dica(bola, `evento-${e.seg}`, e.tipo);
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
          if (atual?.seg === e.seg) encerrar(true);
        });
        caixa.append(icone(t), balao, b);
        posicionar(caixa, pos);
        o.dica(caixa, `evento-${e.seg}`, t);
      }
      camada.append(caixa);
    },
    /** A cada passo da página: a bola pula a cada 1,5 s; passou da janela, encerra (o Jogo do Brasil manda os gols). */
    tick(agoraMs: number) {
      if (!atual) return;
      if (agoraMs >= atual.ateMs) {
        encerrar(atual.tipo === 5);
        return;
      }
      if (atual.tipo === 5) {
        const passo = passoDe(atual.seg, agoraMs);
        if (passo > atual.passo) {
          atual.passo = passo;
          pularBola();
        }
      }
    },
    ativo: () => atual !== null,
  };
}
