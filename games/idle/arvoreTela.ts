// Árvore de habilidades em tela cheia, em forma de copa (raiz embaixo, ramos subindo), e a copa em miniatura do quadro
// do Legado. Só desenha: quem compra é o banco (comprar(id)). O nó escolhido, a escala e o arraste vivem aqui, fora do
// modelo. Texto sempre por textContent.
import { button, el } from '../shared/hud/hud';
import type { IdleState } from '../shared/types';
import { ativos } from './ativos';
import { catalogo, type No } from './catalogo';
import { iconeFechar } from './icones';
import {
  descricaoNo, escalaArvore, falta, faltam, MUNDO_ARVORE, noInicial, ondeNo, pontos, POSICOES_ARVORE, ROTULOS_ARVORE,
  situacaoTela, type SituacaoTela,
} from './legado';

const NS = 'http://www.w3.org/2000/svg';
/** Mexeu mais que isso com o dedo/mouse apertado: é arraste, não toque. */
const ARRASTE_PX = 6;
const LEGENDA: readonly [SituacaoTela, string][] = [
  ['comprado', 'Comprado'], ['pode', 'Dá pra comprar'], ['falta', 'Falta ponto'], ['trancado', 'Trancado'],
];

export type ArvoreTela = {
  elemento: HTMLElement;
  aberta(): boolean;
  /** `volta` devolve o botão que recebe o foco ao fechar (o Abrir é recriado a cada renderização). */
  abrir(s: IdleState, ocupado: boolean, volta: () => HTMLElement | null): void;
  fechar(): void;
  renderizar(s: IdleState, ocupado: boolean): void;
};

const situacoes = (s: IdleState) =>
  new Map(catalogo.arvore.map((n) => [n.id, situacaoTela(n, s.bonus.arvore, s.pontos)] as const));

/** As linhas entre cada nó e o anterior do ramo, num svg (k = px por unidade do mundo). */
function ligacoes(svg: SVGSVGElement, sits: Map<number, SituacaoTela>, k: number) {
  for (const n of catalogo.arvore) {
    if (n.requer === null) continue;
    const [x1, y1] = POSICOES_ARVORE[n.requer];
    const [x2, y2] = POSICOES_ARVORE[n.id];
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', String(x1 * k));
    l.setAttribute('y1', String(y1 * k));
    l.setAttribute('x2', String(x2 * k));
    l.setAttribute('y2', String(y2 * k));
    l.setAttribute('class', `ligacao ${sits.get(n.id)}`);
    svg.append(l);
  }
}

/** Ícone 16x16 ampliado; sem a arte, só a moldura. */
function icone(n: No) {
  const box = el('span', 'icone-legado');
  const url = ativos.no(n.id);
  if (url) box.style.backgroundImage = `url(${url})`;
  else box.classList.add('sem-arte');
  return box;
}

/** A copa em miniatura do quadro do Legado (decorativa: o texto do lado diz quantos comprou). */
export function miniArvore(s: IdleState): SVGSVGElement {
  const sits = situacoes(s);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${MUNDO_ARVORE.largura} ${MUNDO_ARVORE.altura}`);
  svg.setAttribute('class', 'arvore-mini');
  svg.setAttribute('aria-hidden', 'true');
  ligacoes(svg, sits, 1);
  for (const n of catalogo.arvore) {
    const [x, y] = POSICOES_ARVORE[n.id];
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', String(x - 20));
    r.setAttribute('y', String(y - 20));
    r.setAttribute('width', '40');
    r.setAttribute('height', '40');
    r.setAttribute('class', `mini-no ${sits.get(n.id)}`);
    svg.append(r);
    const url = ativos.no(n.id);
    if (url) {
      const im = document.createElementNS(NS, 'image');
      im.setAttribute('href', url);
      im.setAttribute('x', String(x - 16));
      im.setAttribute('y', String(y - 16));
      im.setAttribute('width', '32');
      im.setAttribute('height', '32');
      im.setAttribute('class', `mini-icone ${sits.get(n.id)}`);
      svg.append(im);
    }
  }
  return svg;
}

export function criarArvoreTela(comprar: (id: number) => void): ArvoreTela {
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
  const pontosTopo = el('span', 'arvore-pontos');
  topo.append(fecharB, titulo, pontosTopo);
  const palco = el('div', 'arvore-palco');
  const mundo = el('div', 'arvore-mundo');
  palco.append(mundo);
  const legenda = el('ul', 'arvore-legenda');
  for (const [sit, texto] of LEGENDA) {
    const li = el('li', sit);
    li.append(el('i'), document.createTextNode(texto));
    legenda.append(li);
  }
  const cartao = el('div', 'arvore-cartao');
  cartao.setAttribute('aria-live', 'polite');
  const lado = el('div', 'arvore-lado');
  lado.append(legenda, cartao);
  const corpo = el('div', 'arvore-corpo');
  corpo.append(palco, lado);
  tela.append(topo, corpo);

  let estado: IdleState | null = null;
  let ocupado = false;
  let escolhido: number | null = null;
  let volta: () => HTMLElement | null = () => null;
  let desloc = { x: 0, y: 0 };
  let arraste: { x: number; y: number; dx: number; dy: number; moveu: boolean } | null = null;
  let engolirClique = false;

  const aberta = () => !tela.hasAttribute('hidden');
  // sem tamanho (escondida ou nos testes): escala 1
  const escala = () => (palco.clientWidth && palco.clientHeight ? escalaArvore(palco.clientWidth, palco.clientHeight) : 1);

  /** Prende o arraste às bordas: só dá pra arrastar o que passa do palco. */
  function posicionar() {
    const k = escala();
    const lx = Math.max(0, (MUNDO_ARVORE.largura * k - palco.clientWidth) / 2);
    const ly = Math.max(0, (MUNDO_ARVORE.altura * k - palco.clientHeight) / 2);
    desloc = { x: Math.max(-lx, Math.min(lx, desloc.x)), y: Math.max(-ly, Math.min(ly, desloc.y)) };
    mundo.style.transform = `translate(${desloc.x}px, ${desloc.y}px)`;
  }

  palco.addEventListener('pointerdown', (e) => {
    engolirClique = false;
    arraste = { x: e.clientX, y: e.clientY, dx: desloc.x, dy: desloc.y, moveu: false };
  });
  palco.addEventListener('pointermove', (e) => {
    if (!arraste) return;
    const dx = e.clientX - arraste.x;
    const dy = e.clientY - arraste.y;
    if (!arraste.moveu && Math.hypot(dx, dy) <= ARRASTE_PX) return;
    arraste.moveu = true;
    // o mouse anda em px da tela; o mundo, em px da página (que no PC pode estar ampliada pelo zoom)
    const z = palco.offsetWidth ? palco.getBoundingClientRect().width / palco.offsetWidth || 1 : 1;
    desloc = { x: arraste.dx + dx / z, y: arraste.dy + dy / z };
    posicionar();
  });
  const soltar = () => {
    if (arraste?.moveu) engolirClique = true;
    arraste = null;
  };
  palco.addEventListener('pointerup', soltar);
  palco.addEventListener('pointerleave', soltar);
  palco.addEventListener('pointercancel', () => { arraste = null; });
  // o clique que vem no fim de um arraste não escolhe nó
  palco.addEventListener('click', (e) => {
    if (!engolirClique) return;
    engolirClique = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
  // no documento: o foco pode ter saído da árvore (o Comprar virou "Comprado", clicou no céu) e o Esc ainda fecha
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !aberta()) return;
    e.preventDefault();
    fechar();
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (aberta()) desenhar(); }).observe(palco);

  function desenharCartao(s: IdleState, sits: Map<number, SituacaoTela>) {
    cartao.replaceChildren();
    const n = catalogo.arvore.find((x) => x.id === escolhido);
    if (!n) return;
    const sit = sits.get(n.id)!;
    const ic = icone(n);
    ic.classList.add(sit);
    const texto = el('div', 'meio');
    texto.append(el('strong', undefined, n.nome), el('span', 'onde', ondeNo(n)), el('p', undefined, n.efeito));
    const acao = el('div', 'arvore-acao');
    if (sit === 'comprado') acao.append(el('span', 'no-feito', 'Comprado'));
    else if (sit === 'trancado') acao.append(el('span', 'sub', falta(n)));
    else {
      const b = button(sit === 'pode' ? `Comprar · ${n.custo} ★` : faltam(n.custo - s.pontos), 'btn main', () => comprar(n.id));
      b.disabled = sit !== 'pode' || ocupado;
      acao.append(b);
    }
    cartao.append(ic, texto, acao);
  }

  function desenhar() {
    if (!estado) return;
    const s = estado;
    const sits = situacoes(s);
    const k = escala();
    const W = MUNDO_ARVORE.largura * k;
    const H = MUNDO_ARVORE.altura * k;
    mundo.style.width = `${W}px`;
    mundo.style.height = `${H}px`;
    mundo.style.marginLeft = `${-W / 2}px`;
    mundo.style.marginTop = `${-H / 2}px`;
    // o foco fica no mesmo nó depois de redesenhar
    const focado = (document.activeElement as HTMLElement | null)?.dataset?.no;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));
    svg.setAttribute('aria-hidden', 'true');
    ligacoes(svg, sits, k);
    const filhos: Element[] = [svg];
    for (const r of ROTULOS_ARVORE) {
      const t = el('span', 'arvore-ramo', r.nome);
      t.style.left = `${r.x * k}px`;
      t.style.top = `${r.y * k}px`;
      filhos.push(t);
    }
    for (const n of catalogo.arvore) {
      const sit = sits.get(n.id)!;
      const [x, y] = POSICOES_ARVORE[n.id];
      const b = button('', `no-arvore ${sit}${escolhido === n.id ? ' escolhido' : ''}`, () => {
        escolhido = n.id;
        desenhar();
      });
      b.dataset.no = String(n.id);
      b.style.left = `${x * k}px`;
      b.style.top = `${y * k}px`;
      b.setAttribute('aria-label', descricaoNo(n, sit, s.pontos));
      b.setAttribute('aria-pressed', String(escolhido === n.id));
      b.append(icone(n));
      if (sit === 'pode' || sit === 'falta') b.append(el('span', 'no-custo', `${n.custo} ★`));
      filhos.push(b);
    }
    mundo.replaceChildren(...filhos);
    if (focado) mundo.querySelector<HTMLElement>(`[data-no="${focado}"]`)?.focus();
    posicionar();
    pontosTopo.textContent = `★ ${s.pontos}`;
    pontosTopo.setAttribute('aria-label', `${pontos(s.pontos)} pra gastar`);
    desenharCartao(s, sits);
  }

  function fechar() {
    if (!aberta()) return;
    tela.setAttribute('hidden', '');
    volta()?.focus();
  }

  return {
    elemento: tela,
    aberta,
    abrir(s, ocup, v) {
      estado = s;
      ocupado = ocup;
      volta = v;
      escolhido = noInicial(s.bonus.arvore, s.pontos);
      desloc = { x: 0, y: 0 };
      tela.removeAttribute('hidden');
      desenhar();
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
