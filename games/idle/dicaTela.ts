// A caixinha de informação na tela: mouse por cima (PC) ou foco pelo teclado; no celular não tem (pedido do Juan: o dedo
// é pra comprar e rolar, não pra abrir caixinha por cima das coisas). Uma caixinha só,
// presa ao item pela chave: quando a tela refaz a lista, ela passa pra linha nova com os números novos (conferir()).
import { el } from '../shared/hud/hud';
import type { Dica } from './dica';

const ESPERA_MOUSE = 120;
const MARGEM = 8;

export function criarDicas(app: HTMLElement) {
  const caixa = el('div', 'dica');
  caixa.id = 'idle-dica';
  caixa.setAttribute('role', 'tooltip');
  caixa.setAttribute('hidden', '');
  app.append(caixa);

  const ligados = new Map<string, { alvo: HTMLElement; conteudo: () => Dica | null }>();
  let aberta: string | null = null;
  let ancora: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let ultimoToque = 0;

  const limpar = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  function esconder() {
    limpar();
    ancora?.removeAttribute('aria-describedby');
    aberta = null;
    ancora = null;
    caixa.setAttribute('hidden', '');
  }

  function mostrar(chave: string) {
    const l = ligados.get(chave);
    const d = l?.conteudo();
    if (!l || !d || !l.alvo.isConnected || l.alvo.closest('[hidden]')) return esconder();
    ancora?.removeAttribute('aria-describedby');
    aberta = chave;
    ancora = l.alvo;
    const lista = el('ul');
    for (const linha of d.linhas) lista.append(el('li', linha.tom, linha.texto));
    caixa.replaceChildren(el('strong', undefined, d.titulo), lista);
    caixa.removeAttribute('hidden');
    l.alvo.setAttribute('aria-describedby', caixa.id);
    posicionar(l.alvo);
  }

  /** Do lado do item (direita; sem espaço, esquerda; senão em cima ou embaixo), sem sair da tela. O app pode estar
   *  com zoom (PC): as medidas da tela são divididas por ele. */
  function posicionar(alvo: HTMLElement) {
    const zoom = Number(app.style.zoom) || 1;
    const r = alvo.getBoundingClientRect();
    const larg = window.innerWidth / zoom;
    const alt = window.innerHeight / zoom;
    const a = { l: r.left / zoom, t: r.top / zoom, r: r.right / zoom, b: r.bottom / zoom };
    caixa.style.left = '0px';
    caixa.style.top = '0px';
    const w = caixa.offsetWidth;
    const h = caixa.offsetHeight;
    let x: number;
    let y: number;
    if (a.r + MARGEM + w <= larg - MARGEM) [x, y] = [a.r + MARGEM, a.t];
    else if (a.l - MARGEM - w >= MARGEM) [x, y] = [a.l - MARGEM - w, a.t];
    else [x, y] = [a.l, a.t - MARGEM - h >= MARGEM ? a.t - MARGEM - h : a.b + MARGEM];
    caixa.style.left = `${Math.max(MARGEM, Math.min(x, larg - w - MARGEM))}px`;
    caixa.style.top = `${Math.max(MARGEM, Math.min(y, alt - h - MARGEM))}px`;
  }

  // um toque (celular) em qualquer lugar fecha a que estiver aberta (a do teclado, por exemplo)
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') ultimoToque = Date.now();
    if (aberta && e.pointerType !== 'mouse' && !(ancora?.contains(e.target as Node))) esconder();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aberta) esconder();
  });
  window.addEventListener('scroll', () => aberta && ancora && posicionar(ancora), true);

  function ligar(alvo: HTMLElement, chave: string, conteudo: () => Dica | null) {
    ligados.set(chave, { alvo, conteudo });
    alvo.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      limpar();
      timer = setTimeout(() => mostrar(chave), ESPERA_MOUSE);
    });
    alvo.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (aberta === chave) esconder();
      else limpar();
    });
    // teclado: o foco que veio do Tab (não de um toque/clique) mostra
    alvo.addEventListener('focusin', () => {
      if (Date.now() - ultimoToque > 800 && !alvo.matches(':hover')) mostrar(chave);
    });
    alvo.addEventListener('focusout', (e) => {
      if (aberta === chave && !alvo.contains(e.relatedTarget as Node)) esconder();
    });
    if (aberta === chave) {
      ancora = null; // a linha foi refeita: a caixinha passa pra ela em conferir()
    }
  }

  /** Depois de a tela refazer as listas: a caixinha aberta segue a linha nova (com os números novos) ou fecha. */
  function conferir() {
    if (!aberta) return;
    const l = ligados.get(aberta);
    if (l && l.alvo.isConnected && !l.alvo.closest('[hidden]')) mostrar(aberta);
    else esconder();
  }

  return { ligar, conferir, esconder };
}
