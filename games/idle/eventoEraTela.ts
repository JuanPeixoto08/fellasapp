// Eventos de era na tela (14/10): o desenho de pixel de cada um com o botão dele, um por vez. Clicar chama `aoPegar`
// (o banco confere). O Jogo do Brasil é diferente: a bola pula de ponto em ponto e cada clique é gol; manda os gols no
// 7º ou quando a janela acaba (sem gol, não manda nada).
import { JANELA_EVENTO_S, MAX_GOLS, NOME_EVENTO_ERA, type TipoEventoEra } from './eventosEra';

const PALETA: Record<string, string> = {
  K: '#1E1B2E', B: '#5A3A1E', S: '#D9A066', H: '#FF5A7A', R: '#E0454B', W: '#F4F1EA', O: '#F07A2A', Q: '#B8501A',
  C: '#5AA9E6', A: '#2A5BD7', N: '#8A8796',
};
// 12 × 12, uma letra por pixel ('.' = vazio). A bola não tem desenho aqui: é o .evento-bola (CSS).
const ICONES: Record<1 | 2 | 3 | 4, readonly string[]> = {
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
};
const BOTAO: Record<1 | 2 | 3 | 4, string> = { 1: 'Já vou!', 2: 'Abrir pacote', 3: 'Sair da call', 4: 'Reiniciar' };
const BALAO: Record<1 | 2 | 3 | 4, string> = {
  1: 'Desce pra almoçar!', 2: 'Seu pacote chegou', 3: 'Reunião: alinhamento do alinhamento', 4: 'Seu PC encontrou um problema',
};

const NS = 'http://www.w3.org/2000/svg';
function icone(tipo: 1 | 2 | 3 | 4): SVGSVGElement {
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

export type OpcoesEventoEra = {
  aoPegar(seg: number, gols: number): void;
  /** liga a caixinha de informação (mouse/teclado) no elemento */
  dica(el: HTMLElement, chave: string, tipo: TipoEventoEra): void;
  /** onde fica (fração da tela); `i` = o pulo da bola */
  posicao(seg: number, i: number): { x: number; y: number };
};

export function criarEventoEraTela(raiz: HTMLElement, o: OpcoesEventoEra) {
  const camada = document.createElement('div');
  camada.className = 'eventos-era';
  raiz.append(camada);
  let atual: { seg: number; tipo: TipoEventoEra; ateMs: number; caixa: HTMLElement; gols: number; pulo: number } | null = null;
  const encerrados = new Set<number>();

  function encerrar(enviar: boolean) {
    if (!atual) return;
    const a = atual;
    atual = null;
    a.caixa.remove();
    encerrados.add(a.seg);
    if (enviar && (a.tipo !== 5 || a.gols > 0)) o.aoPegar(a.seg, a.tipo === 5 ? a.gols : 0);
  }
  function posicionar(el: HTMLElement, p: { x: number; y: number }) {
    el.style.left = `${Math.round(p.x * 100)}%`;
    el.style.top = `${Math.round(p.y * 100)}%`;
  }

  return {
    mostrar(e: { seg: number; tipo: TipoEventoEra; agoraMs: number }) {
      const ateMs = (e.seg + JANELA_EVENTO_S[e.tipo]) * 1000;
      if (atual || encerrados.has(e.seg) || e.agoraMs >= ateMs) return;
      const caixa = document.createElement('div');
      caixa.className = `evento-era evento-era-${e.tipo}`;
      caixa.style.setProperty('--janela', `${JANELA_EVENTO_S[e.tipo]}s`);
      caixa.style.setProperty('--ja', `-${Math.max(0, Math.round((e.agoraMs - e.seg * 1000) / 1000))}s`);
      atual = { seg: e.seg, tipo: e.tipo, ateMs, caixa, gols: 0, pulo: 0 };
      if (e.tipo === 5) {
        const placar = document.createElement('div');
        placar.className = 'evento-placar';
        placar.textContent = `0 de ${MAX_GOLS}`;
        const bola = document.createElement('button');
        bola.type = 'button';
        bola.className = 'evento-bola';
        bola.setAttribute('aria-label', 'Chutar pro gol');
        posicionar(bola, o.posicao(e.seg, 0));
        bola.addEventListener('click', () => {
          if (!atual || atual.seg !== e.seg) return;
          atual.gols++;
          placar.textContent = `${atual.gols} de ${MAX_GOLS}`;
          posicionar(bola, o.posicao(e.seg, ++atual.pulo));
          if (atual.gols >= MAX_GOLS) encerrar(true);
        });
        caixa.append(placar, bola);
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
        posicionar(caixa, o.posicao(e.seg, 0));
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
        const pulo = Math.floor((agoraMs - atual.seg * 1000) / 1500);
        if (pulo > atual.pulo) {
          atual.pulo = pulo;
          const bola = atual.caixa.querySelector<HTMLElement>('.evento-bola');
          if (bola) posicionar(bola, o.posicao(atual.seg, pulo));
        }
      }
    },
    ativo: () => atual !== null,
  };
}
