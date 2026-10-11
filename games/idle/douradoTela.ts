// Eventos na tela (tipo cookie dourado): o ícone de pixel num ponto sorteado, com brilho, balançando, e um anel que
// esvazia nos 12 s (pisca nos 3 últimos). Clicar chama `aoPegar` (o banco confere). Também o texto que sobe quando pega.
import { JANELA_S, type TipoDourado } from './dourados';

export const NOME_DOURADO: Record<0 | 1 | 2, string> = { 0: 'Investidor apressado', 1: 'Promoção relâmpago', 2: 'Viralizou' };

// ícones 12 × 12, uma letra por pixel (cor na paleta; '.' = vazio)
const PALETA: Record<string, string> = {
  D: '#5A3A1E', B: '#8B5A2B', Y: '#F2D27A', G: '#5FD38D', R: '#E0454B', K: '#1E1B2E', C: '#5AA9E6', H: '#FF5A7A', W: '#F4F1EA',
};
const ICONES: Record<0 | 1 | 2, readonly string[]> = {
  // maleta com as notas escapando
  0: [
    '....DDDD....', '....D..D....', '..GG.DD.GG..', '.GGBBBBBBGG.', '.BBBBBBBBBB.', '.BBBBYYBBBB.',
    '.DDDDYYDDDD.', '.BBBBBBBBBB.', '.BBBBBBBBBB.', '.BBBBBBBBBB.', '.DDDDDDDDDD.', '............',
  ],
  // relâmpago amarelo no selo vermelho
  1: [
    '....RRRR....', '..RRRRRRRR..', '.RRRRRYYRRR.', '.RRRRYYRRRR.', 'RRRRYYRRRRRR', 'RRRYYYYYYRRR',
    'RRRRRRYYRRRR', 'RRRRRYYRRRRR', '.RRRYYRRRRR.', '.RRRYRRRRRR.', '..RRRRRRRR..', '....RRRR....',
  ],
  // celular com corações saindo
  2: [
    '...KKKKKK...', '...KCCCCK..H', '...KCHHCK.HH', '..HKHHHHK...', '..HKCHHCK...', '...KCCCCK...',
    '...KCCCCK.H.', '...KCCCCKHHH', '...KCCCCK.H.', '...KCCCCK...', '...KKWKKK...', '............',
  ],
};

const NS = 'http://www.w3.org/2000/svg';
function icone(tipo: 0 | 1 | 2): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('class', 'icone-dourado');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  const porCor = new Map<string, string>();
  ICONES[tipo].forEach((linha, y) =>
    [...linha].forEach((c, x) => {
      if (c !== '.') porCor.set(c, `${porCor.get(c) ?? ''}M${x} ${y}h1v1h-1z`);
    }),
  );
  for (const [c, d] of porCor) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', PALETA[c]);
    svg.append(p);
  }
  return svg;
}
function anel(): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('class', 'anel');
  svg.setAttribute('aria-hidden', 'true');
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('cx', '32');
  c.setAttribute('cy', '32');
  c.setAttribute('r', '29');
  c.setAttribute('pathLength', '100');
  svg.append(c);
  return svg;
}

export type EventoNaTela = { seg: number; lado: number; tipo: TipoDourado; x: number; y: number; agoraMs: number };

export function criarDouradoTela(raiz: HTMLElement, aoPegar: (seg: number, lado: number) => void) {
  const camada = document.createElement('div');
  camada.className = 'dourados';
  raiz.append(camada);
  const ativos = new Map<string, { botao: HTMLButtonElement; ateMs: number }>();
  const encerrados = new Set<string>(); // pegos ou passados: não voltam

  function tirar(chave: string) {
    ativos.get(chave)?.botao.remove();
    ativos.delete(chave);
    encerrados.add(chave);
  }

  return {
    /** Mostra o evento (se ainda dá tempo e não apareceu antes). A dupla chama duas vezes, lado 0 e 1. */
    mostrar(e: EventoNaTela) {
      const chave = `${e.seg}:${e.lado}`;
      const ateMs = e.seg * 1000 + JANELA_S * 1000;
      if (ativos.has(chave) || encerrados.has(chave) || e.agoraMs >= ateMs) return;
      const tipo = (e.tipo === 3 ? 2 : e.tipo) as 0 | 1 | 2;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `dourado dourado-${tipo}`;
      b.setAttribute('aria-label', `Pegar: ${NOME_DOURADO[tipo]}`);
      b.style.left = `${Math.round(e.x * 100)}%`;
      b.style.top = `${Math.round(e.y * 100)}%`;
      b.style.setProperty('--ja', `-${Math.max(0, Math.round((e.agoraMs - e.seg * 1000) / 1000))}s`);
      b.append(anel(), icone(tipo));
      b.addEventListener('click', () => {
        if (!ativos.has(chave)) return;
        tirar(chave);
        aoPegar(e.seg, e.lado);
      });
      camada.append(b);
      ativos.set(chave, { botao: b, ateMs });
    },
    /** A cada passo da página: tira o que passou do tempo. */
    tick(agoraMs: number) {
      for (const [chave, a] of ativos) if (agoraMs >= a.ateMs) tirar(chave);
    },
    /** O texto que sobe quando pega ("+F$ 1,2 mi", "×100!"), no ponto do evento. */
    subirTexto(texto: string, x: number, y: number) {
      const t = document.createElement('div');
      t.className = 'dourado-texto';
      t.setAttribute('role', 'status');
      t.textContent = texto;
      t.style.left = `${Math.round(x * 100)}%`;
      t.style.top = `${Math.round(y * 100)}%`;
      camada.append(t);
      setTimeout(() => t.remove(), 1600);
    },
  };
}
