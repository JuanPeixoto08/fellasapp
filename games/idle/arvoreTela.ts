// Árvore de habilidades em tela cheia (a constelação da árvore grande: 120 nós, os ramos como raios saindo da raiz, o anel
// da era 7) e as barrinhas do quadro do Legado. Só desenha: quem compra é o banco (comprar(id)). O nó escolhido, o zoom e o
// arraste vivem aqui, fora do modelo. Texto sempre por textContent. Hierarquia por tamanho e forma (o nó 10 maior com
// moldura dupla; o infinito em losango com o nível; a ponte com moldura de trilho) e o estado com forma além da cor
// (comprado cheio; dá pra comprar com traço lilás e o preço; falta ponto com o preço apagado; portão com cadeado; trancado
// em silhueta) — spec §7. Longe (zoom < 1/3), os ícones borrariam abaixo de 16 px: os nós viram estrelinhas.
import { button, el } from '../shared/hud/hud';
import type { IdleState } from '../shared/types';
import { ativos } from './ativos';
import { catalogo, ORDEM_RAMOS, RAMO_PONTE, type No } from './catalogo';
import { dicaNo, type Dica } from './dica';
import { iconeFechar } from './icones';
import {
  alturaBarra, ANEIS_ARVORE, contextoArvore, descricaoNo, escalaMinima, falta, faltam, limitarZoom, MUNDO_ARVORE, nivelNo, noInicial, ondeNo,
  pontos, portao, POSICOES_ARVORE, posicaoRotulo, precoNo, progressoRamo, raioAnelTela, RAMOS_ARVORE, ramoDoNo, ROTULOS_ARVORE, situacaoTela,
  ZOOM_ABRIR, ZOOM_LONGE, ZOOM_MAX, ZOOM_MIN, ZOOM_ROTULOS, type ContextoArvore, type SituacaoTela,
} from './legado';
import { RAMOS } from './nomes';

const NS = 'http://www.w3.org/2000/svg';
/** Mexeu mais que isso com o dedo/mouse apertado: é arraste, não toque. */
const ARRASTE_PX = 6;
const PASSO_ZOOM = 1.25;
/** Com os nomes à vista, o arraste passa um pouco da borda do mundo (os nomes dos raios de lado saem do quadrado). */
const FOLGA_PX = 140;
/** Meia abertura do anel em volta do "Era 7" (px da tela): a linha nunca passa por baixo do texto. */
const VAO_ANEL_PX = 34;
const LEGENDA: readonly [SituacaoTela, string][] = [
  ['comprado', 'Comprado'], ['pode', 'Dá pra comprar'], ['falta', 'Falta ponto'], ['portao', 'Tem portão'], ['trancado', 'Trancado'],
];
/** A fileira de ramos: a Raiz no meio, os ramos na ordem da copa (ela fica parada enquanto a copa arrasta). */
const FILEIRA: readonly number[] = [...ORDEM_RAMOS.slice(0, 5), 0, ...ORDEM_RAMOS.slice(5)];

export type LigarDica = (alvo: HTMLElement, chave: string, conteudo: () => Dica | null) => void;
export type ArvoreTela = {
  elemento: HTMLElement;
  aberta(): boolean;
  /** `volta` devolve o botão que recebe o foco ao fechar (o Abrir é recriado a cada renderização); `no` = o nó que abre
   *  escolhido (sem ele, o mais barato que dá pra comprar). */
  abrir(s: IdleState, ocupado: boolean, volta: () => HTMLElement | null, no?: number): void;
  fechar(): void;
  renderizar(s: IdleState, ocupado: boolean): void;
};

const situacoes = (c: ContextoArvore) => new Map(catalogo.arvore.map((n) => [n.id, situacaoTela(n, c)] as const));
/** A forma do nó: comum, o 10 de cada ramo (maior), o infinito (losango) ou a ponte. */
const formaDe = (n: No) => (n.ramo === RAMO_PONTE ? 'ponte' : n.posicao === 11 ? 'infinito' : n.posicao === 10 ? 'grande' : 'comum');

/** As linhas entre cada nó e o que ele pede (ao longo do raio; a ponte tem duas, uma pra cada nó 5), num svg (k = px por
 *  unidade do mundo). Entre dois que você tem, a linha acende (o caminho comprado). */
function ligacoes(svg: SVGSVGElement, sits: Map<number, SituacaoTela>, c: ContextoArvore, k: number) {
  for (const n of catalogo.arvore) {
    for (const r of [n.requer, n.requer2]) {
      if (r === null) continue;
      const [x1, y1] = POSICOES_ARVORE[r];
      const [x2, y2] = POSICOES_ARVORE[n.id];
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', String(x1 * k));
      l.setAttribute('y1', String(y1 * k));
      l.setAttribute('x2', String(x2 * k));
      l.setAttribute('y2', String(y2 * k));
      const acesa = c.arvore.includes(n.id) && c.arvore.includes(r);
      l.setAttribute('class', `ligacao ${acesa ? 'acesa' : sits.get(n.id)}`);
      svg.append(l);
    }
  }
}

/** Os anéis de era: um círculo com um vão em cima, onde fica o nome ("Era 7"). Devolve os nomes (spans) pra pôr no mundo. */
function aneis(svg: SVGSVGElement, k: number): HTMLElement[] {
  const c = (MUNDO_ARVORE.largura / 2) * k;
  return ANEIS_ARVORE.map((a) => {
    const r = raioAnelTela(a, k);
    const vao = Math.min(Math.PI / 4, VAO_ANEL_PX / r);
    const [ini, fim] = [-Math.PI / 2 + vao, -Math.PI / 2 - vao + 2 * Math.PI];
    const p = (t: number) => `${(c + r * Math.cos(t)).toFixed(1)} ${(c + r * Math.sin(t)).toFixed(1)}`;
    const arco = document.createElementNS(NS, 'path');
    arco.setAttribute('d', `M ${p(ini)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${p(fim)}`);
    arco.setAttribute('class', 'arvore-anel');
    svg.prepend(arco); // por baixo das ligações
    const t = el('span', 'arvore-anel-rotulo', a.rotulo);
    t.style.left = `${c}px`;
    t.style.top = `${c - r}px`;
    return t;
  });
}

/** Ícone 16x16 ampliado; sem a arte, só a moldura. */
export function iconeNo(n: No) {
  const box = el('span', 'icone-legado');
  const url = ativos.no(n.id);
  if (url) box.style.backgroundImage = `url(${url})`;
  else box.classList.add('sem-arte');
  return box;
}

/** A silhueta da copa no quadro do Legado: 10 barrinhas (uma por ramo, na ordem da copa, as do meio mais altas) cheias na
 *  proporção dos 10 nós fixos que você tem. Decorativa: o texto do lado diz quantos. */
export function copaBarras(s: IdleState): HTMLElement {
  const c = contextoArvore(s);
  const box = el('div', 'copa-barras');
  box.setAttribute('aria-hidden', 'true');
  ORDEM_RAMOS.forEach((ramo, k) => {
    const { comprados, total } = progressoRamo(ramo, c);
    const b = el('span', 'barra');
    b.style.setProperty('--alto', alturaBarra(k).toFixed(3));
    b.style.setProperty('--cheio', `${Math.round((comprados / total) * 100)}%`);
    if (comprados === total) b.classList.add('cheia');
    box.append(b);
  });
  return box;
}

/** `dicas`: depois de redesenhar com a vista parada (comprou, escolheu), a caixinha aberta segue o nó novo com os números
 *  de agora (conferir); quando a vista anda (zoom, arraste, pulo pra um ramo), ela fecha (esconder): o nó saiu de baixo
 *  do mouse. */
export type DicasArvore = { conferir(): void; esconder(): void };
export function criarArvoreTela(comprar: (id: number) => void, ligarDica: LigarDica = () => {}, dicas: DicasArvore = { conferir() {}, esconder() {} }): ArvoreTela {
  const tela = el('div', 'arvore-tela');
  tela.setAttribute('role', 'dialog');
  tela.setAttribute('aria-modal', 'true');
  tela.setAttribute('aria-labelledby', 'idle-titulo-arvore');
  tela.setAttribute('hidden', '');
  const topo = el('div', 'arvore-topo');
  const fecharB = button('', 'fechar', () => fechar());
  fecharB.setAttribute('aria-label', 'Fechar');
  fecharB.append(iconeFechar());
  const titulo = el('h2', undefined, 'Árvore de habilidades');
  titulo.id = 'idle-titulo-arvore';
  const zoomMenos = button('−', 'btn compacto zoom-menos', () => mudarZoom(1 / PASSO_ZOOM));
  zoomMenos.setAttribute('aria-label', 'Afastar');
  const zoomMais = button('+', 'btn compacto zoom-mais', () => mudarZoom(PASSO_ZOOM));
  zoomMais.setAttribute('aria-label', 'Aproximar');
  const zooms = el('div', 'arvore-zoom');
  zooms.append(zoomMenos, zoomMais);
  const pontosTopo = el('span', 'arvore-pontos');
  topo.append(fecharB, titulo, pontosTopo);
  const fileira = el('div', 'arvore-fileira');
  fileira.setAttribute('role', 'toolbar');
  fileira.setAttribute('aria-label', 'Ramos');
  const palco = el('div', 'arvore-palco');
  const mundo = el('div', 'arvore-mundo');
  // o zoom flutua no canto do palco, como num mapa (o topo fica numa linha só, também no celular)
  palco.append(mundo, zooms);
  const legenda = el('ul', 'arvore-legenda');
  for (const [sit, texto] of LEGENDA) {
    const li = el('li', sit);
    li.append(el('i', sit === 'portao' ? 'cadeado' : undefined), document.createTextNode(texto));
    legenda.append(li);
  }
  const cartao = el('div', 'arvore-cartao');
  cartao.setAttribute('aria-live', 'polite');
  const lado = el('div', 'arvore-lado');
  lado.append(legenda, cartao);
  const corpo = el('div', 'arvore-corpo');
  corpo.append(palco, lado);
  tela.append(topo, fileira, corpo);

  let estado: IdleState | null = null;
  let ocupado = false;
  let escolhido: number | null = null;
  let volta: () => HTMLElement | null = () => null;
  let desloc = { x: 0, y: 0 };
  let zoom = ZOOM_ABRIR;
  let arraste: { x: number; y: number; dx: number; dy: number; moveu: boolean } | null = null;
  let pinca: { d0: number; z0: number; dx: number; dy: number } | null = null;
  const toques = new Map<number, { x: number; y: number }>();
  let engolirClique = false;

  const aberta = () => !tela.hasAttribute('hidden');
  // sem tamanho (escondida ou nos testes): o mínimo é o ZOOM_MIN
  const minimo = () => (palco.clientWidth && palco.clientHeight ? escalaMinima(palco.clientWidth, palco.clientHeight) : ZOOM_MIN);
  const k = () => limitarZoom(zoom, minimo());
  /** O mouse anda em px da tela; o mundo, em px da página (que no PC pode estar ampliada pelo zoom). */
  const zoomPagina = () => (palco.offsetWidth ? palco.getBoundingClientRect().width / palco.offsetWidth || 1 : 1);

  /** Prende o arraste às bordas: só dá pra arrastar o que passa do palco (com os nomes à vista, uma folga a mais). */
  function posicionar() {
    const kk = k();
    const folga = kk >= ZOOM_ROTULOS ? FOLGA_PX : 0;
    const lx = Math.max(0, (MUNDO_ARVORE.largura * kk - palco.clientWidth) / 2 + folga);
    const ly = Math.max(0, (MUNDO_ARVORE.altura * kk - palco.clientHeight) / 2 + folga);
    desloc = { x: Math.max(-lx, Math.min(lx, desloc.x)), y: Math.max(-ly, Math.min(ly, desloc.y)) };
    mundo.style.transform = `translate(${desloc.x}px, ${desloc.y}px)`;
  }
  /** Põe o nó no meio do palco (o que der: a borda da copa segura). */
  function centrar(id: number) {
    const [x, y] = POSICOES_ARVORE[id];
    const kk = k();
    desloc = { x: (MUNDO_ARVORE.largura / 2 - x) * kk, y: (MUNDO_ARVORE.altura / 2 - y) * kk };
  }
  /** Aproxima/afasta em volta de um ponto do palco (px a partir do meio dele; os botões: o meio). */
  function mudarZoom(f: number, px = 0, py = 0) {
    const antes = k();
    zoom = limitarZoom(antes * f, minimo());
    const r = k() / antes;
    desloc = { x: px + (desloc.x - px) * r, y: py + (desloc.y - py) * r };
    desenhar(true);
  }

  palco.addEventListener('pointerdown', (e) => {
    engolirClique = false;
    toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.size === 2) {
      const [a, b] = [...toques.values()];
      pinca = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: k(), dx: desloc.x, dy: desloc.y };
      arraste = null;
      return;
    }
    arraste = { x: e.clientX, y: e.clientY, dx: desloc.x, dy: desloc.y, moveu: false };
  });
  palco.addEventListener('pointermove', (e) => {
    if (toques.has(e.pointerId)) toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinca && toques.size >= 2) {
      const [a, b] = [...toques.values()];
      zoom = limitarZoom((pinca.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinca.d0, minimo());
      const r = k() / pinca.z0;
      desloc = { x: pinca.dx * r, y: pinca.dy * r };
      engolirClique = true; // o fim da pinça não escolhe nem compra
      desenhar(true);
      return;
    }
    if (!arraste) return;
    const dx = e.clientX - arraste.x;
    const dy = e.clientY - arraste.y;
    if (!arraste.moveu && Math.hypot(dx, dy) <= ARRASTE_PX) return;
    if (!arraste.moveu) dicas.esconder();
    arraste.moveu = true;
    const z = zoomPagina();
    desloc = { x: arraste.dx + dx / z, y: arraste.dy + dy / z };
    posicionar();
  });
  const soltar = (e: PointerEvent) => {
    toques.delete(e.pointerId);
    if (toques.size < 2) pinca = null;
    if (arraste?.moveu) engolirClique = true;
    arraste = null;
  };
  palco.addEventListener('pointerup', soltar);
  palco.addEventListener('pointerleave', soltar);
  palco.addEventListener('pointercancel', (e) => {
    toques.delete(e.pointerId);
    pinca = null;
    arraste = null;
  });
  // o clique que vem no fim de um arraste ou de uma pinça não escolhe nó
  palco.addEventListener('click', (e) => {
    if (!engolirClique) return;
    engolirClique = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
  // a rodinha do mouse aproxima e afasta em volta do mouse (no PC)
  palco.addEventListener('wheel', (e) => {
    if (!aberta()) return;
    e.preventDefault();
    const r = palco.getBoundingClientRect();
    const z = zoomPagina();
    mudarZoom(e.deltaY < 0 ? PASSO_ZOOM : 1 / PASSO_ZOOM, (e.clientX - r.left) / z - palco.clientWidth / 2, (e.clientY - r.top) / z - palco.clientHeight / 2);
  }, { passive: false });
  // Tab num nó fora da vista: o navegador rolaria o palco (overflow escondido) por baixo do arraste; em vez disso, a copa
  // traz o nó pro meio
  palco.addEventListener('focusin', (e) => {
    const alvo = e.target as HTMLElement;
    palco.scrollLeft = 0;
    palco.scrollTop = 0;
    let doTeclado = false;
    try {
      doTeclado = alvo.matches(':focus-visible');
    } catch {
      doTeclado = false;
    }
    if (!doTeclado || !alvo.dataset.no) return;
    const r = alvo.getBoundingClientRect();
    const p = palco.getBoundingClientRect();
    if (r.left >= p.left && r.right <= p.right && r.top >= p.top && r.bottom <= p.bottom) return;
    centrar(Number(alvo.dataset.no));
    posicionar();
    dicas.conferir();
  });
  // no documento: o foco pode ter saído da árvore (o Comprar virou "Comprado", clicou no céu) e o Esc ainda fecha
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !aberta()) return;
    e.preventDefault();
    fechar();
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (aberta()) desenhar(true); }).observe(palco);

  /** Pula pro raio de um ramo: escolhe o próximo dele (o 1º que não é seu; o infinito que você tem segue sendo o
   *  próximo; a Raiz é a raiz) e o põe no meio, num zoom que dá pra ler. */
  function irPraRamo(ramo: number) {
    if (!estado) return;
    const c = contextoArvore(estado);
    const nos = RAMOS_ARVORE[ramo].nos;
    const alvo = nos.find((n) => situacaoTela(n, c) !== 'comprado') ?? nos[nos.length - 1];
    escolhido = alvo.id;
    zoom = Math.max(k(), ZOOM_ABRIR);
    centrar(alvo.id);
    desenhar(true);
  }

  function desenharFileira() {
    const n = catalogo.arvore.find((x) => x.id === escolhido);
    const atual = n ? ramoDoNo(n) : null;
    const focado = fileira.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.ramo : undefined;
    fileira.replaceChildren(...FILEIRA.map((ramo) => {
      const b = button('', `ramo-botao${atual === ramo ? ' ativo' : ''}`, () => irPraRamo(ramo));
      b.dataset.ramo = String(ramo);
      b.setAttribute('aria-pressed', String(atual === ramo));
      b.append(iconeNo(RAMOS_ARVORE[ramo].nos[0]), el('span', 'nome', RAMOS[ramo]));
      return b;
    }));
    if (focado) fileira.querySelector<HTMLElement>(`[data-ramo="${focado}"]`)?.focus();
    // o ramo ativo à vista na fileira (no celular ela rola)
    fileira.querySelector('.ativo')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }

  function desenharCartao(s: IdleState, c: ContextoArvore, sits: Map<number, SituacaoTela>) {
    const n = catalogo.arvore.find((x) => x.id === escolhido);
    if (!n) return cartao.replaceChildren();
    const sit = sits.get(n.id)!;
    const ic = iconeNo(n);
    ic.classList.add(sit, formaDe(n));
    // o onde em cima (sobretítulo), o nome grande, o efeito; embaixo o nível (no infinito) e a ação lado a lado
    const texto = el('div', 'meio');
    texto.append(el('span', 'onde', ondeNo(n)), el('strong', undefined, n.nome), el('p', undefined, n.efeito));
    const acao = el('div', 'arvore-acao');
    // o infinito que você tem: o nível de agora → o próximo (o preço junto quando o botão não diz)
    if (n.cresce !== null && c.arvore.includes(n.id)) {
      const nv = nivelNo(n, c);
      acao.append(el('span', 'nivel', `Nível ${nv} → ${nv + 1}${sit === 'pode' ? '' : ` · ${precoNo(n, c)} ★`}`));
    }
    if (sit === 'comprado') acao.append(el('span', 'no-feito', 'Comprado'));
    else if (sit === 'trancado') acao.append(el('span', 'sub', falta(n)));
    else if (sit === 'portao') {
      const motivo = el('span', 'portao-motivo');
      motivo.append(el('i', 'cadeado'), document.createTextNode(portao(n, c) ?? ''));
      acao.append(motivo);
    } else {
      const preco = precoNo(n, c);
      const b = button(sit === 'pode' ? `Comprar · ${preco} ★` : faltam(preco - s.pontos), 'btn main', () => comprar(n.id));
      b.disabled = sit !== 'pode' || ocupado;
      acao.append(b);
    }
    cartao.replaceChildren(ic, texto, acao);
  }

  /** `vistaAndou`: o zoom ou o lugar mudou (a caixinha aberta fecha); sem ele, ela segue o nó com os números novos. */
  function desenhar(vistaAndou = false) {
    if (!estado) return;
    const s = estado;
    const c = contextoArvore(s);
    const sits = situacoes(c);
    const kk = k();
    const W = MUNDO_ARVORE.largura * kk;
    const H = MUNDO_ARVORE.altura * kk;
    mundo.style.width = `${W}px`;
    mundo.style.height = `${H}px`;
    mundo.style.marginLeft = `${-W / 2}px`;
    mundo.style.marginTop = `${-H / 2}px`;
    mundo.style.setProperty('--z', String(Math.min(1, kk)));
    const comRotulos = kk >= ZOOM_ROTULOS - 1e-9;
    mundo.classList.toggle('sem-rotulos', !comRotulos);
    mundo.classList.toggle('longe', kk < ZOOM_LONGE);
    // o foco fica no mesmo nó depois de redesenhar
    const focado = (document.activeElement as HTMLElement | null)?.dataset?.no;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));
    svg.setAttribute('aria-hidden', 'true');
    ligacoes(svg, sits, c, kk);
    const filhos: Element[] = [svg, ...aneis(svg, kk)];
    const rotulos = ROTULOS_ARVORE.map((r) => {
      const t = el('span', 'arvore-ramo', r.nome);
      t.setAttribute('aria-hidden', 'true'); // a fileira já diz os ramos
      filhos.push(t);
      return { r, t };
    });
    for (const n of catalogo.arvore) {
      const sit = sits.get(n.id)!;
      const [x, y] = POSICOES_ARVORE[n.id];
      const nivelado = n.cresce !== null && c.arvore.includes(n.id);
      const b = button('', `no-arvore ${sit} ${formaDe(n)}${nivelado ? ' nivelado' : ''}${escolhido === n.id ? ' escolhido' : ''}`, () => {
        escolhido = n.id;
        desenhar();
      });
      b.dataset.no = String(n.id);
      b.style.left = `${x * kk}px`;
      b.style.top = `${y * kk}px`;
      b.setAttribute('aria-label', descricaoNo(n, sit, c));
      b.setAttribute('aria-pressed', String(escolhido === n.id));
      b.append(iconeNo(n));
      if (sit === 'pode' || sit === 'falta') b.append(el('span', 'no-custo', `${precoNo(n, c)} ★`));
      if (sit === 'portao') {
        const placa = el('span', 'no-cadeado'); // a etiqueta de baixo: o preço, ou o cadeado se tem portão
        placa.append(el('i', 'cadeado'));
        b.append(placa);
      }
      if (nivelado) b.append(el('span', 'no-nivel', `nv ${nivelNo(n, c)}`));
      ligarDica(b, `no-${n.id}`, () => (estado ? dicaNo(estado, n) : null));
      filhos.push(b);
    }
    mundo.replaceChildren(...filhos);
    // os nomes dos ramos: a caixa inteira por fora do anel (mede o texto; sem medida, nos testes, uma estimativa)
    if (comRotulos) {
      for (const { r, t } of rotulos) {
        const p = posicaoRotulo(r.ramo, kk, t.offsetWidth || r.nome.length * 8, t.offsetHeight || 18);
        t.style.left = `${p.x}px`;
        t.style.top = `${p.y}px`;
      }
    }
    if (focado) mundo.querySelector<HTMLElement>(`[data-no="${focado}"]`)?.focus({ preventScroll: true });
    posicionar();
    pontosTopo.textContent = `★ ${s.pontos}`;
    pontosTopo.setAttribute('aria-label', `${pontos(s.pontos)} pra gastar`);
    zoomMenos.disabled = kk <= minimo() + 1e-9;
    zoomMais.disabled = kk >= ZOOM_MAX - 1e-9;
    desenharFileira();
    desenharCartao(s, c, sits);
    if (vistaAndou) dicas.esconder();
    else dicas.conferir();
  }

  function fechar() {
    if (!aberta()) return;
    tela.setAttribute('hidden', '');
    volta()?.focus();
  }

  return {
    elemento: tela,
    aberta,
    abrir(s, ocup, v, no) {
      estado = s;
      ocupado = ocup;
      volta = v;
      escolhido = no ?? noInicial(contextoArvore(s));
      tela.removeAttribute('hidden');
      zoom = ZOOM_ABRIR;
      centrar(escolhido);
      desenhar(true);
      fecharB.focus();
    },
    fechar,
    renderizar(s, ocup) {
      estado = s;
      ocupado = ocup;
      if (aberta()) desenhar();
    },
  };
}
