// Mapa do rolê em tela cheia (DOM): o mapa noturno 160 × 96 em escala inteira (a maior que cabe, como a cena) e os 9
// pinos por cima, em % do mapa. Pino fechado = cadeado + preço (compra), aberto = nível (entra), "Em breve" = apagado.
// Quem decide abrir é o banco; aqui só mostra e chama. Nome e imagens dos lugares vêm do banco (nada no código).
import { button, el } from '../shared/hud/hud';
import type { IdleVisual, MapaEstado, PinoMapa } from '../shared/types';
import { ativos } from './ativos';
import { dicaPino } from './dica';
import { formatarValor } from './formatar';
import { posicaoGenerica } from './mapa';
import type { Dicas } from './mecanicas';
import { criarFoco } from './foco';
import { aplicarTema } from './temasLugar';

export const MAPA_W = 160;
export const MAPA_H = 96;
type Precos = { botao: HTMLButtonElement; preco: number };
/** O boneco de alguém (o mesmo desenho do placar); sem quem desenhe, um quadradinho vazio. */
export type Boneco = (v: IdleVisual | null) => HTMLElement;

export const nomeLugar = (l: { id: number; nome: string | null }) => l.nome || `Lugar ${l.id}`;

/** Escala inteira do mapa que cabe em `largura` × `altura` px de tela (altura null = só a largura manda, no celular). */
export function escalaMapa(largura: number, altura: number | null): number {
  const k = Math.min(largura / MAPA_W, altura === null ? Infinity : altura / MAPA_H);
  return Math.max(1, Math.floor(k + 1e-9));
}

export function criarMapaTela(a: { entrar(id: number): void; abrir(id: number): void }, dicas: Dicas, boneco: Boneco = () => el('span')) {
  const raiz = el('div', 'mapa-tela');
  const palco = el('div', 'mapa-palco');
  const quadro = el('div', 'mapa-quadro');
  palco.append(quadro);
  const rodape = el('div', 'mapa-rodape');
  const lista = el('ul', 'mapa-lista');
  lista.setAttribute('aria-label', 'Lugares');
  raiz.append(palco, rodape, lista);
  let atuais: Precos[] = [];
  /** O F$ de agora (sobe entre um desenho e outro): a caixinha do pino conta o que falta com ele. */
  let valorAgora = 0;
  /** Os pinos e as linhas são refeitos a cada desenho: o foco do teclado volta pro do mesmo lugar (data-foco). */
  const foco = criarFoco(raiz);

  /** O quadro do mapa em escala inteira: na tela de verdade (px do aparelho = px do CSS × o zoom do PC). */
  function ajustar() {
    if (!raiz.isConnected) return;
    const zoom = Number((raiz.closest('.idle') as HTMLElement | null)?.style.zoom) || 1;
    const celular = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1099px)').matches;
    // PC: a lista dos lugares fica do lado (--mapa-lista no CSS, mais o vão); o mapa fica com o resto da largura
    const css = getComputedStyle(raiz);
    const lado = celular ? 0 : (parseFloat(css.getPropertyValue('--mapa-lista')) || 0) + (parseFloat(css.columnGap) || 0);
    const w = raiz.clientWidth - lado;
    const h = palco.clientHeight;
    if (!w) return;
    const k = escalaMapa(w * zoom, celular ? null : h * zoom);
    quadro.style.width = `${(MAPA_W * k) / zoom}px`;
    quadro.style.height = `${(MAPA_H * k) / zoom}px`;
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(ajustar).observe(raiz);

  /** O que o lugar é agora e se dá pra tocar nele (o mesmo pro pino e pra linha da lista do celular). */
  function situacao(p: PinoMapa, valuation: number, era: number, ocupado: boolean) {
    const estado = p.aberto ? 'aberto' : p.lancado ? 'fechado' : 'breve';
    const semEra = estado === 'fechado' && era < p.era;
    const disabled = estado === 'breve' || (estado === 'fechado' && (ocupado || semEra || p.preco <= 0 || valuation < p.preco));
    const soDinheiro = estado === 'fechado' && !ocupado && !semEra && p.preco > 0;
    return { estado, semEra, disabled, soDinheiro } as const;
  }

  function icone(p: PinoMapa, cls: string) {
    const i = el('span', cls);
    const img = p.icone ?? ativos.mapa();
    if (img) i.style.backgroundImage = `url(${img})`;
    i.setAttribute('aria-hidden', 'true');
    return i;
  }

  function cadeado() {
    const c = el('i', 'pino-cadeado');
    const url = ativos.estudio('cadeado');
    if (url) c.style.backgroundImage = `url(${url})`;
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  function rotulo(p: PinoMapa, estado: 'aberto' | 'fechado' | 'breve', semEra: boolean) {
    const nome = nomeLugar(p);
    if (estado === 'aberto') return `${nome}: aberto, nível ${p.nivel ?? 1}. Entrar`;
    if (estado === 'fechado') return `${nome}: fechado, abre por ${formatarValor(p.preco)}${semEra ? `, precisa da era ${p.era}` : ''}`;
    return `${nome}: em breve`;
  }

  function pino(p: PinoMapa, valuation: number, era: number, ocupado: boolean, precos: Precos[]): HTMLButtonElement {
    const nome = nomeLugar(p);
    const { estado, semEra, disabled, soDinheiro } = situacao(p, valuation, era, ocupado);
    const bt = button('', `pino ${estado}`, () => (p.aberto ? a.entrar(p.id) : a.abrir(p.id)));
    bt.dataset.lugar = String(p.id);
    bt.dataset.foco = `pino${p.id}`;
    aplicarTema(bt, p.id); // o destaque do pino com as cores do lugar
    const pos = p.x !== null && p.y !== null ? { x: p.x, y: p.y } : posicaoGenerica(p.id);
    bt.style.left = `${(pos.x / MAPA_W) * 100}%`;
    bt.style.top = `${(pos.y / MAPA_H) * 100}%`;
    const selo = el('span', 'pino-selo');
    if (estado === 'aberto') selo.textContent = `Nível ${p.nivel ?? 1}`;
    else if (estado === 'fechado') selo.append(cadeado(), el('span', undefined, formatarValor(p.preco)));
    else selo.textContent = 'Em breve';
    bt.disabled = disabled;
    if (soDinheiro) precos.push({ botao: bt, preco: p.preco });
    bt.setAttribute('aria-label', rotulo(p, estado, semEra));
    if (estado === 'fechado') dicas.ligar(bt, `pino${p.id}`, nome, () => dicaPino(p, valorAgora, era));
    bt.append(icone(p, 'pino-icone'), el('span', 'pino-nome', nome), selo);
    if (semEra) bt.append(el('span', 'pino-era', `Era ${p.era}`));
    if (p.dono) {
      const dono = boneco(p.dono.avatar);
      dono.classList.add('pino-dono');
      bt.append(dono);
    }
    return bt;
  }

  /** A lista dos lugares: do lado do mapa no PC; embaixo dele no celular, onde o mapa fica pequeno (alvos grandes, nome inteiro). */
  function linha(p: PinoMapa, valuation: number, era: number, ocupado: boolean, precos: Precos[]): HTMLLIElement {
    const { estado, semEra, disabled, soDinheiro } = situacao(p, valuation, era, ocupado);
    const bt = button('', `lugar-linha ${estado}`, () => (p.aberto ? a.entrar(p.id) : a.abrir(p.id)));
    bt.dataset.lugar = String(p.id);
    bt.dataset.foco = `linha${p.id}`;
    aplicarTema(bt, p.id);
    bt.disabled = disabled;
    if (soDinheiro) precos.push({ botao: bt, preco: p.preco });
    bt.setAttribute('aria-label', rotulo(p, estado, semEra));
    // a mesma caixinha do pino (no PC a lista fica do lado do mapa), com a chave dela
    if (estado === 'fechado') dicas.ligar(bt, `linha${p.id}`, nomeLugar(p), () => dicaPino(p, valorAgora, era));
    const meio = el('span', 'meio');
    meio.append(el('strong', undefined, nomeLugar(p)));
    if (p.frase) meio.append(el('span', 'sub', p.frase));
    const fim = el('span', 'lugar-linha-fim');
    if (estado === 'aberto') fim.textContent = `Nível ${p.nivel ?? 1}`;
    else if (estado === 'fechado') {
      fim.append(cadeado(), el('span', undefined, formatarValor(p.preco)));
      if (semEra) fim.append(el('span', 'pino-era', `Era ${p.era}`));
    } else fim.textContent = 'Em breve';
    bt.append(icone(p, 'pino-icone'), meio, fim);
    const li = el('li');
    li.append(bt);
    return li;
  }

  function renderizar(m: MapaEstado | null, valuation: number, era: number, ocupado: boolean): void {
    atuais = [];
    valorAgora = valuation;
    const chave = foco.guardar();
    if (!m) {
      quadro.replaceChildren(el('div', 'mapa-generico'), el('p', 'vazio mapa-carregando', 'Carregando o mapa…'));
      rodape.replaceChildren();
      lista.replaceChildren();
      ajustar();
      return;
    }
    let fundo: HTMLElement;
    if (m.mapa) {
      const img = el('img', 'mapa-img');
      img.src = m.mapa;
      img.alt = '';
      img.draggable = false;
      fundo = img;
    } else fundo = el('div', 'mapa-generico');
    const precos: Precos[] = [];
    quadro.replaceChildren(fundo, ...m.lugares.map((p) => pino(p, valuation, era, ocupado, precos)));
    lista.replaceChildren(...m.lugares.map((p) => linha(p, valuation, era, ocupado, precos)));
    atuais = precos;
    // embaixo: quanto os lugares já somam na produção e a legenda dos pinos
    const abertos = m.lugares.filter((p) => p.aberto).length;
    const bonus = Math.round((m.mult - 1) * 1000) / 10;
    const resumo = el('p', 'mapa-resumo');
    resumo.append(
      el('b', undefined, bonus > 0 ? `+${bonus.toLocaleString('pt-BR')}%` : '+0%'),
      document.createTextNode(abertos ? ' de produção na empresa vindo dos lugares' : ' de produção por enquanto. Abre um lugar: cada marco dele soma aqui'),
    );
    const legenda = el('div', 'mapa-legenda');
    for (const [cls, t] of [['fechado', 'Fechado: abre com F$'], ['aberto', 'Aberto: entra no lugar'], ['breve', 'Em breve']] as const) {
      const s = el('span');
      s.append(el('i', cls), document.createTextNode(t));
      legenda.append(s);
    }
    rodape.replaceChildren(resumo, legenda);
    foco.devolver(chave);
    ajustar();
  }

  return {
    elemento: raiz,
    renderizar,
    /** Os pinos que o F$ acende e apaga (vazio com o mapa fora da tela). */
    precos: () => (raiz.isConnected ? atuais : []),
    ajustar,
    /** O F$ subindo (a cada passo da página). */
    valor: (v: number) => { valorAgora = v; },
  };
}
