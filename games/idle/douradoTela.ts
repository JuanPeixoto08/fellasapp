// Eventos na tela (tipo cookie dourado): o ícone de pixel num ponto sorteado, com brilho, balançando, e um anel que
// esvazia na janela (pisca nos 3 últimos s). Clicar chama `aoPegar` (o banco confere). Os novos (0076) fazem algo antes:
// o Trend abre a chuva de moedinhas (8 s; manda quantas pegou), o Pix abre a escolha (Ficar / Devolver; vai no lado) e
// o Tigrinho gira o rolo (pega na hora; o resultado vem do banco em `pararTigre`). Também o texto que sobe quando pega.
import { CHUVA_S, JANELA_S, type TipoDourado } from './dourados';

export const NOME_DOURADO: Record<TipoDourado, string> = {
  0: 'Investidor apressado', 1: 'Promoção relâmpago', 2: 'Viralizou', 3: 'Viralizou', 4: 'Trend do TikTok', 5: 'Bombou no LinkedIn',
  6: 'Pix errado', 7: 'Tigrinho',
};
/** Moedinhas que caem num Trend (o banco conta até 20). */
export const MOEDINHAS = 25;
/** O rolo do Tigrinho gira pelo menos isto (ms) antes de parar no resultado. */
const ROLO_MS = 1500;

// ícones 12 × 12, uma letra por pixel (cor na paleta; '.' = vazio)
const PALETA: Record<string, string> = {
  D: '#5A3A1E', B: '#8B5A2B', Y: '#F2D27A', G: '#5FD38D', R: '#E0454B', K: '#1E1B2E', C: '#5AA9E6', H: '#FF5A7A', W: '#F4F1EA',
  A: '#2A5BD7', O: '#F07A2A', V: '#2E9E5B',
};
type Icone = 0 | 1 | 2 | 4 | 5 | 6 | 7 | 'moeda';
const ICONES: Record<Icone, readonly string[]> = {
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
  // Trend do TikTok: a nota musical com a sombra rosa e azul
  4: [
    '............', '......HKKK..', '......KWWKC.', '......KWKWKC', '......KWK.KC', '......KWK...',
    '..HKKKKWK...', '.HKWWWWWKC..', '.HKWWWWWKC..', '..KWWWWK.C..', '...KKKKCC...', '............',
  ],
  // Bombou no LinkedIn: a maleta azul
  5: [
    '............', '....AAAA....', '....A..A....', '.AAAAAAAAAA.', '.ACCCCCCCCA.', '.ACCCCCCCCA.',
    '.AAAAWWAAAA.', '.ACCCWWCCCA.', '.ACCCCCCCCA.', '.ACCCCCCCCA.', '.AAAAAAAAAA.', '............',
  ],
  // Pix errado: o losango verde (sem o logo do Pix)
  6: [
    '.....GG.....', '....GGGG....', '...GGVVGG...', '..GGVWWVGG..', '.GGVWWWWVGG.', 'GGVWWVVWWVGG',
    'GGVWWVVWWVGG', '.GGVWWWWVGG.', '..GGVWWVGG..', '...GGVVGG...', '....GGGG....', '.....GG.....',
  ],
  // Tigrinho: a cabeça do tigre
  7: [
    '.OO......OO.', '.OKO....OKO.', '.OOOOOOOOOO.', 'OOKOOOOOOKOO', 'OWWKOOOOKWWO', 'OWKWOOOOWKWO',
    'OOOOOKKOOOOO', 'OKOOOKKOOOKO', '.OKOWWWWOKO.', '..OWWKKWWO..', '...OWWWWO...', '....OOOO....',
  ],
  // a moedinha do Trend (o jogo não tinha moeda: decisão do plano)
  moeda: [
    '....YYYY....', '..YYDDDDYY..', '.YDYYYYYYDY.', '.YDYYKKYYDY.', 'YDYYKYYYYYDY', 'YDYYYKKYYYDY',
    'YDYYYYYKYYDY', 'YDYYKKKYYYDY', '.YDYYKYYYDY.', '.YDYYYYYYDY.', '..YYDDDDYY..', '....YYYY....',
  ],
};

const NS = 'http://www.w3.org/2000/svg';
function icone(tipo: Icone): SVGSVGElement {
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

export type EventoNaTela = {
  seg: number; lado: number; tipo: TipoDourado; x: number; y: number; agoraMs: number;
  /** s na tela (Gemaplys encurta) */ janelaS?: number; /** garantido do Pix devolvido: rende o dobro */ dobro?: boolean;
};
export type OpcoesDourado = {
  /** liga a caixinha de informação (mouse/teclado) nos dourados novos */
  dica?(alvo: HTMLElement, chave: string, tipo: TipoDourado, seg: number, dobro: boolean): void;
  /** a moedinha pega e o rolo girando (os outros sons são do main, com a resposta do banco) */
  som?(id: 'trend' | 'tigreGira'): void;
  /** relógio local (ms) da chuva e do rolo; os testes trocam */
  agora?(): number;
  /** o ícone saiu da tela (clicado ou passou do tempo): a caixinha dele fecha na hora (o Trend e o Pix só pegam depois) */
  saiu?(): void;
};

export function criarDouradoTela(raiz: HTMLElement, aoPegar: (seg: number, lado: number, moedas?: number) => void, o: OpcoesDourado = {}) {
  const agora = o.agora ?? (() => Date.now());
  const camada = document.createElement('div');
  camada.className = 'dourados';
  raiz.append(camada);
  const ativos = new Map<string, { botao: HTMLButtonElement; ateMs: number }>();
  const encerrados = new Set<string>(); // pegos ou passados: não voltam
  // o que vem depois do clique: a chuva do Trend (uma por vez), a escolha do Pix e o rolo do Tigrinho
  let chuva: { seg: number; el: HTMLElement; ate: number; moedas: number } | null = null;
  const escolhas = new Map<number, { el: HTMLElement; ateMs: number }>();
  const rolos = new Map<number, { el: HTMLElement; desde: number }>();

  function tirar(chave: string) {
    const a = ativos.get(chave);
    a?.botao.remove();
    ativos.delete(chave);
    encerrados.add(chave);
    if (a) o.saiu?.();
  }
  /** Um elemento no ponto do evento (o CSS prende dentro da tela, como o .dourado). */
  function noPonto(el: HTMLElement, e: EventoNaTela) {
    el.style.setProperty('--x', `${Math.round(e.x * 100)}%`);
    el.style.top = `${Math.round(e.y * 100)}%`;
  }

  function fecharChuva() {
    if (!chuva) return;
    const c = chuva;
    chuva = null;
    c.el.remove();
    aoPegar(c.seg, 0, c.moedas);
  }
  function abrirChuva(seg: number) {
    fecharChuva(); // uma por vez: a anterior manda o que tinha
    const el = document.createElement('div');
    el.className = 'chuva'; // trava a tela atrás por 8 s: clique que erra a moedinha não compra nada
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Chuva de moedinhas: passe o mouse ou o dedo por cima delas');
    const placar = document.createElement('div');
    placar.className = 'chuva-placar';
    placar.setAttribute('role', 'status');
    placar.textContent = '0 moedinhas';
    el.append(placar);
    const c = { seg, el, ate: agora() + CHUVA_S * 1000, moedas: 0 };
    /** Pega a moedinha (passou o mouse, o dedo ou apertou no teclado); cada uma conta uma vez só (sai da tela). */
    const pegarMoeda = (m: Element) => {
      if (chuva !== c || !m.isConnected) return;
      c.moedas++;
      placar.textContent = `${c.moedas} ${c.moedas === 1 ? 'moedinha' : 'moedinhas'}`;
      m.remove();
      o.som?.('trend');
    };
    const moedaEm = (alvo: EventTarget | Element | null) =>
      alvo instanceof Element ? alvo.closest<HTMLElement>('.moedinha') : null;
    // mouse: basta passar por cima (o clique em coisa que cai era difícil demais)
    el.addEventListener('pointerover', (e) => {
      const m = moedaEm(e.target);
      if (m) pegarMoeda(m);
    });
    // dedo: o toque fica preso no elemento onde começou, então procura a moedinha que está embaixo do dedo agora
    const debaixoDoDedo = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const m = moedaEm(document.elementFromPoint(e.clientX, e.clientY));
      if (m && el.contains(m)) pegarMoeda(m);
    };
    el.addEventListener('pointerdown', debaixoDoDedo);
    el.addEventListener('pointermove', debaixoDoDedo);
    for (let i = 0; i < MOEDINHAS; i++) {
      const m = document.createElement('button');
      m.type = 'button';
      m.className = 'moedinha';
      m.setAttribute('aria-label', 'Pegar moedinha');
      // espalhadas na largura (o segundo é a semente) e caindo uma atrás da outra; sem animação, paradas em --y
      m.style.left = `${6 + (((seg * 37 + i * 53) % 89) / 89) * 88}%`;
      m.style.setProperty('--y', `${12 + ((i * 37) % 76)}%`);
      m.style.animationDelay = `${((i * (CHUVA_S - 2.4)) / MOEDINHAS).toFixed(2)}s`;
      m.append(icone('moeda'));
      m.addEventListener('click', () => pegarMoeda(m)); // teclado (Enter/espaço) continua valendo
      el.append(m);
    }
    camada.append(el);
    chuva = c;
  }
  function abrirEscolha(e: EventoNaTela, ateMs: number) {
    const el = document.createElement('div');
    el.className = 'pix-escolha';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Pix errado: ficar ou devolver');
    noPonto(el, e);
    // a caixa de diálogo do jogo (como a do Abrir CNPJ): a fala em cima e as duas escolhas lado a lado
    const texto = document.createElement('p');
    texto.className = 'fala';
    texto.textContent = 'Caiu um Pix errado na sua conta';
    const linha = document.createElement('div');
    linha.className = 'escolhas';
    const escolher = (lado: number) => {
      if (!escolhas.has(e.seg)) return;
      escolhas.get(e.seg)!.el.remove();
      escolhas.delete(e.seg);
      aoPegar(e.seg, lado);
    };
    const botoes = (['Ficar', 'Devolver'] as const).map((rot, lado) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = rot;
      b.addEventListener('click', () => escolher(lado));
      return b;
    });
    linha.append(...botoes);
    el.append(texto, linha);
    camada.append(el);
    escolhas.set(e.seg, { el, ateMs });
  }
  function girarRolo(e: EventoNaTela) {
    const el = document.createElement('div');
    el.className = 'tigre-rolo girando';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Tigrinho girando');
    noPonto(el, e);
    // três rolos de caça-níquel, cada um com 7 / ★ / $ girando (o último repete o primeiro: a volta não pula)
    for (let k = 0; k < 3; k++) {
      const janela = document.createElement('span');
      janela.className = 'rolo';
      const faixa = document.createElement('span');
      faixa.className = 'rolo-faixa';
      faixa.style.animationDelay = `${-k * 0.07}s`;
      for (const c of ['7', '★', '$', '7']) {
        const x = document.createElement('span');
        x.textContent = c;
        faixa.append(x);
      }
      janela.append(faixa);
      el.append(janela);
    }
    camada.append(el);
    rolos.set(e.seg, { el, desde: agora() });
    o.som?.('tigreGira');
  }

  return {
    /** Mostra o evento (se ainda dá tempo e não apareceu antes). A dupla chama duas vezes, lado 0 e 1. */
    mostrar(e: EventoNaTela) {
      const chave = `${e.seg}:${e.lado}`;
      const janela = e.janelaS ?? JANELA_S;
      const ateMs = e.seg * 1000 + janela * 1000;
      if (ativos.has(chave) || encerrados.has(chave) || e.agoraMs >= ateMs) return;
      const t = e.tipo;
      const ic: Icone = t === 3 ? 2 : t;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `dourado dourado-${ic}${e.dobro ? ' dobro' : ''}`;
      b.setAttribute('aria-label', `Pegar: ${NOME_DOURADO[t]}${e.dobro ? ' (em dobro)' : ''}`);
      // a dupla lado a lado, o segundo pro lado que tem espaço; o CSS prende dentro da tela (clamp)
      const pct = Math.round(e.x * 100);
      b.style.setProperty('--x', e.lado !== 1 ? `${pct}%` : `calc(${pct}% ${e.x > 0.5 ? '-' : '+'} 84px)`);
      b.style.top = `${Math.round(e.y * 100)}%`;
      if (e.janelaS !== undefined) b.style.setProperty('--janela', `${e.janelaS}s`);
      b.style.setProperty('--ja', `-${Math.max(0, Math.round((e.agoraMs - e.seg * 1000) / 1000))}s`);
      b.append(anel(), icone(ic));
      if (e.dobro) {
        const selo = document.createElement('span');
        selo.className = 'dobro-selo';
        selo.setAttribute('aria-hidden', 'true');
        selo.textContent = '2×';
        b.append(selo);
      }
      b.addEventListener('click', () => {
        if (!ativos.has(chave)) return;
        tirar(chave);
        if (t === 4) abrirChuva(e.seg);
        else if (t === 6) abrirEscolha(e, (e.seg + janela + CHUVA_S) * 1000);
        else {
          if (t === 7) girarRolo(e);
          aoPegar(e.seg, e.lado);
        }
      });
      camada.append(b);
      ativos.set(chave, { botao: b, ateMs });
      if (t >= 4) o.dica?.(b, `dourado-${e.seg}`, t, e.seg, !!e.dobro);
    },
    /** A cada passo da página: tira o que passou do tempo (ícones, escolhas do Pix) e fecha a chuva no fim dos 8 s. */
    tick(agoraMs: number) {
      for (const [chave, a] of ativos) if (agoraMs >= a.ateMs) tirar(chave);
      for (const [seg, x] of escolhas) {
        if (agoraMs >= x.ateMs) {
          x.el.remove();
          escolhas.delete(seg);
        }
      }
      if (chuva && agora() >= chuva.ate) fecharChuva();
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
    /** O banco respondeu o Tigrinho: o rolo para no resultado (no mínimo 1,5 s depois do clique), chama `aoParar` e some
     *  1,2 s depois. `pagou` null = deu erro: o rolo só some. */
    pararTigre(seg: number, pagou: boolean | null, aoParar?: () => void) {
      const r = rolos.get(seg);
      if (!r) return;
      if (pagou === null) {
        rolos.delete(seg);
        r.el.remove();
        return;
      }
      const parar = () => {
        rolos.delete(seg);
        r.el.classList.remove('girando');
        r.el.classList.add(pagou ? 'pagou' : 'comeu');
        r.el.setAttribute('aria-label', pagou ? 'Tigrinho pagou' : 'Tigrinho comeu');
        r.el.replaceChildren(document.createTextNode(pagou ? 'PAGOU' : 'COMEU'));
        aoParar?.();
        setTimeout(() => r.el.remove(), 1200);
      };
      const falta = r.desde + ROLO_MS - agora();
      if (falta > 0) setTimeout(parar, falta);
      else parar();
    },
  };
}
