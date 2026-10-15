// Tela da Bolsa em tela cheia (DOM puro): à esquerda as 8 empresas (ícone do gerador ligado, gráfico da última hora,
// preço, variação e o que você tem); à direita a empresa escolhida (gráfico grande com a linha do que você pagou, os
// números, comprar/vender e os lotes do Vorcaro) e embaixo as melhorias da Bolsa. Mockup aprovado em 12/10.
import { button, el } from '../shared/hud/hud';
import type { BolsaEmpresa, BolsaEstado, BolsaPosicao, LadoBolsa, MelhoriaBolsa } from '../shared/types';
import { acoes, avisosPo, contaLimite, empresa, lucro, maxCompra, melhoriaAtual, pct, proximaMelhoria, textoQuebra, variacao } from './bolsa';
import { ativos } from './ativos';
import { type Dica, dicaEspiar } from './dica';
import { formatarValor } from './formatar';

const NS = 'http://www.w3.org/2000/svg';
type Precos = { botao: HTMLButtonElement; preco: number };

const classeVar = (x: number) => (x > 0.0005 ? 'sobe' : x < -0.0005 ? 'cai' : '');
/** O humor da empresa pro VSauce (0 parada · 1 sobe devagar · 2 cai devagar · 3 sobe forte · 4 despenca · 5 maluca). */
const HUMOR = ['Parada', 'Subindo devagar', 'Caindo devagar', 'Subindo forte', 'Despencando', 'Maluca'];
/** O jeito de cada empresa (o que esperar dela), pelo código. */
const JEITO: Record<string, string> = {
  PSTL: 'firme, sobe devagar', ACAI: 'firme e cara', COCH: 'sobe na hype e despenca', PRMO: 'maluca',
  JEGU: 'barata e instável', MEME: 'maluca e barata', IRMA: 'parada', SIMA: 'média, oscila bastante',
};

/** Gráfico de linha da última hora (preenchido embaixo); `pagou` desenha a linha tracejada do preço médio pago. */
function grafico(cls: string, h: number[], pagou?: number): SVGSVGElement {
  const W = cls === 'mini' ? 64 : 600;
  const H = cls === 'mini' ? 28 : 200;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const vals = pagou !== undefined ? [...h, pagou] : h;
  const max = Math.max(...vals, 1e-9);
  const min = Math.min(...vals, max);
  const y = (v: number) => H - 3 - ((v - min) / Math.max(max - min, 1e-9)) * (H - 6);
  const x = (i: number) => (h.length > 1 ? (i / (h.length - 1)) * W : W / 2);
  const sobe = h.length > 1 && h[h.length - 1] >= h[0];
  const ponto = (v: number, i: number) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  const novo = (tag: string, attrs: Record<string, string>) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.append(n);
    return n;
  };
  if (cls !== 'mini') for (let g = 1; g < 4; g++) novo('line', { x1: '0', x2: String(W), y1: String((g * H) / 4), y2: String((g * H) / 4), class: 'grade-graf' });
  if (h.length > 1) {
    if (cls !== 'mini') novo('polygon', { points: `0,${H} ${h.map(ponto).join(' ')} ${W},${H}`, class: `area ${sobe ? 'sobe' : 'cai'}` });
    novo('polyline', { points: h.map(ponto).join(' '), class: `linha ${sobe ? 'sobe' : 'cai'}`, 'vector-effect': 'non-scaling-stroke' });
  }
  if (pagou !== undefined) novo('line', { x1: '0', x2: String(W), y1: y(pagou).toFixed(1), y2: y(pagou).toFixed(1), class: 'pagou', 'vector-effect': 'non-scaling-stroke' });
  return svg;
}

/** O ícone do gerador ligado à empresa (1º quadro do sprite). */
function iconeEmpresa(m: BolsaEmpresa, cls: string): HTMLElement {
  const i = el('span', cls);
  i.setAttribute('aria-hidden', 'true');
  i.style.backgroundImage = `url(${ativos.gerador(empresa(m.id).gerador)})`;
  return i;
}

export function criarBolsaTela(a: {
  negociar(empresa: number, lado: LadoBolsa, qtd: 0 | 1 | 10, tick: number, lote?: number): void;
  melhorar(tipo: MelhoriaBolsa, nivel: number): void;
  espiar?(empresa: number): void;
}, dica?: (alvo: HTMLElement, chave: string, conteudo: () => Dica | null) => void) {
  const raiz = el('div', 'bolsa');
  let escolhida: number | null = null;
  let ultimo: [BolsaEstado | null, number, boolean, number, boolean] | null = null;
  // o fim da recuperação de cada empresa quebrada que a tela viu: no minuto em que ela volta o banco vira o humor na hora
  // (o humor dela "acaba" agora), e espiar ali gastaria o crédito sem mostrar nada. No minuto seguinte já dá.
  const fimRj = new Map<number, number>();

  let relogioEl: HTMLElement | null = null;
  // botões de compra que só dependem do F$ (o atualizarValor da página acende e apaga a cada 100 ms)
  let atuais: Precos[] = [];
  /** "Preço novo em m:ss" do detalhe aberto, chamado pela página enquanto o minuto corre. */
  function relogio(ms: number) {
    if (!relogioEl) return;
    const s = Math.max(0, Math.ceil(ms / 1000));
    relogioEl.textContent = `Preço novo em ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  /** `alavanca`: o lote das compras agora (1 + o peso do Vorcaro; 1 sem ele). `vsauce`: o VSauce está sentado (é ele
   *  quem mostra o humor, mesmo de empresa espiada). */
  function renderizar(b: BolsaEstado | null, valuation: number, ocupado: boolean, alavanca = 1, vsauce = false): void {
    // redesenhar troca a lista e o detalhe por novos: guarda a rolagem e o foco pra devolver no fim
    const rolouLista = raiz.querySelector<HTMLElement>('.bolsa-lista')?.scrollTop ?? 0;
    const detalheAntes = raiz.querySelector<HTMLElement>('.bolsa-detalhe');
    const rolouDetalhe = detalheAntes && detalheAntes.dataset.empresa === String(escolhida) ? detalheAntes.scrollTop : 0;
    const ativo = document.activeElement;
    const focoEmpresa = ativo instanceof HTMLElement && raiz.contains(ativo) ? ativo.closest<HTMLElement>('.acao')?.dataset.empresa : undefined;
    ultimo = [b, valuation, ocupado, alavanca, vsauce];
    raiz.replaceChildren();
    relogioEl = null;
    atuais = [];
    if (!b) {
      raiz.append(el('p', 'vazio', 'Carregando a Bolsa…'));
      return;
    }
    if (!b.aberta) {
      raiz.append(el('p', 'vazio', 'Compra 1 Grupo de trader pra abrir a Bolsa.'));
      return;
    }
    for (const m of b.empresas) if (m.rj_ate !== null) fimRj.set(m.id, m.rj_ate);
    // sempre tem uma empresa escolhida (a 1ª, se nenhuma)
    if (!b.empresas.some((m) => m.id === escolhida)) escolhida = b.empresas[0]?.id ?? null;
    // as ações normais (lote 1) e os lotes alavancados do Vorcaro de cada empresa; o limite conta todos
    const pos = (id: number): BolsaPosicao | undefined => b.carteira.find((p) => p.empresa === id && (p.alavanca ?? 1) === 1);
    const lotes = (id: number) => b.carteira.filter((p) => p.empresa === id && (p.alavanca ?? 1) > 1);
    const total = (id: number) => b.carteira.filter((p) => p.empresa === id).reduce((n, p) => n + p.qtd, 0);
    const precos: Precos[] = [];

    // ----- a lista -----
    const esq = el('div', 'bolsa-esq');
    const cab = el('div', 'bolsa-cab');
    const valorTotal = b.carteira.reduce((s, p) => s + p.qtd * (b.empresas.find((e) => e.id === p.empresa)?.valor ?? 0), 0) * b.r;
    const lucroTotal = valorTotal - b.carteira.reduce((s, p) => s + p.custo, 0) * b.r;
    const cart = el('div', 'carteira');
    const c1 = el('span');
    c1.append('Carteira ', el('b', undefined, formatarValor(valorTotal)));
    const c2 = el('span');
    c2.append('Lucro ', el('b', classeVar(lucroTotal), `${lucroTotal >= 0 ? '+' : '−'}${formatarValor(Math.abs(lucroTotal))}`));
    cart.append(c1, c2);
    cab.append(el('span', 'rot2', `${b.empresas.length} empresas · preço em F$`), cart);
    esq.append(cab);
    // ações que viraram pó (a empresa quebrou): o aviso fica aqui até fechar a Bolsa (a página guarda)
    if (b.viraram_po.length) {
      const po = el('div', 'bolsa-po');
      po.setAttribute('role', 'status');
      for (const t of avisosPo(b.viraram_po)) po.append(el('p', undefined, t));
      esq.append(po);
    }
    const lista = el('div', 'bolsa-lista');
    for (const m of b.empresas) {
      const e = empresa(m.id);
      const p = pos(m.id);
      const li = button('', `acao${escolhida === m.id ? ' escolhida' : ''}${m.rj_ate !== null ? ' quebrada' : ''}`, () => {
        escolhida = m.id;
        if (ultimo) renderizar(...ultimo);
        // no celular o detalhe fica embaixo da lista: leva até ele
        if (window.innerWidth < 1100) raiz.querySelector('.bolsa-detalhe')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      });
      li.dataset.empresa = String(m.id);
      li.setAttribute('aria-pressed', String(escolhida === m.id));
      const nome = el('span', 'tk', e.codigo);
      if (m.rj_ate !== null) nome.append(el('span', 'etq rj', textoQuebra(m.rj_ate, b.tick)));
      else if (m.risco) nome.append(el('span', 'etq risco', 'Pode quebrar'));
      else if (m.humor !== undefined && m.humor !== null) nome.append(el('span', `etq humor humor-${m.humor}`, HUMOR[m.humor] ?? ''));
      nome.append(el('small', undefined, e.nome));
      const preco = el('span', 'preco', m.rj_ate !== null ? '—' : formatarValor(m.valor * b.r));
      const v = variacao(m.historico);
      if (m.rj_ate === null) preco.append(el('small', classeVar(v.hora), `${pct(v.hora)} na hora`));
      const tem = el('span', 'tem');
      if (p) {
        const l = lucro(m.valor, p);
        tem.append(el('b', undefined, acoes(total(m.id))), el('span', classeVar(l), `${pct(l)} de lucro`));
      } else if (total(m.id)) tem.append(el('b', undefined, acoes(total(m.id))), el('span', 'sub', 'Alavancadas'));
      else tem.textContent = m.rj_ate !== null ? '' : '—';
      li.append(iconeEmpresa(m, 'acao-icone'), nome, m.rj_ate !== null ? el('span') : grafico('mini', m.historico.slice(-30)), preco, tem);
      lista.append(li);
    }
    esq.append(lista);

    // ----- a empresa escolhida -----
    const dir = el('div', 'bolsa-dir');
    const m = b.empresas.find((x) => x.id === escolhida)!;
    const e = empresa(m.id);
    const p = pos(m.id);
    const tem = total(m.id);
    const d = el('div', 'bolsa-detalhe');
    d.dataset.empresa = String(m.id);
    d.setAttribute('aria-live', 'polite');
    const dcab = el('div', 'cab');
    const nome = el('span', 'tk', e.codigo);
    nome.append(el('small', undefined, `${e.nome} · ${JEITO[e.codigo] ?? ''}`));
    relogioEl = el('span', 'relogio-bolsa');
    relogioEl.setAttribute('role', 'timer'); // timer não é anunciado a cada mudança (o detalhe é aria-live)
    relogio(b.vira_em_ms);
    dcab.append(iconeEmpresa(m, 'det-icone'), nome, relogioEl);
    d.append(dcab);
    if (m.rj_ate !== null) {
      d.append(el('p', 'sub', textoQuebra(m.rj_ate, b.tick)));
    } else {
      const v = variacao(m.historico);
      const linhaPreco = el('div', 'preco-grande');
      linhaPreco.append(el('b', undefined, formatarValor(m.valor * b.r)), el('span', classeVar(v.minuto), `${pct(v.minuto)} no minuto · ${pct(v.hora)} na hora`));
      // o humor: o VSauce sentado mostra ("Ou não?"); espiado (Informação privilegiada, 0076) diz também quando muda
      if (m.humor !== undefined && m.humor !== null) {
        const humor = (HUMOR[m.humor] ?? '').toLowerCase();
        const muda = m.espiada && m.muda_em ? ` · muda em ${m.muda_em} min` : '';
        linhaPreco.append(el('span', 'humor-vsauce', m.espiada && !vsauce ? `Espiado: ${humor} agora${muda}` : `VSauce: ${humor} agora. Ou não?${muda}`));
      }
      const creditos = b.info_creditos ?? 0;
      if (a.espiar && creditos > 0 && !m.espiada) {
        const virando = fimRj.get(m.id) === b.tick; // saiu da recuperação neste minuto (ver fimRj)
        const esp = button(`Espiar (${creditos})`, 'btn compacto espiar', () => a.espiar!(m.id));
        esp.disabled = ocupado || virando;
        dica?.(esp, `espiar-${m.id}`, () => {
          const d = dicaEspiar(e.nome, creditos);
          return virando ? { ...d, linhas: [...d.linhas, { texto: 'Acabou de voltar da recuperação: o humor vira neste minuto. Espia no próximo', tom: 'ruim' }] } : d;
        });
        linhaPreco.append(esp);
      }
      d.append(linhaPreco);
      const graf = el('div', 'bolsa-graf');
      const pagou = p ? p.custo / p.qtd : undefined;
      graf.append(grafico('graf', m.historico, pagou));
      if (pagou !== undefined) {
        const max = Math.max(...m.historico, pagou);
        const min = Math.min(...m.historico, pagou);
        const rot = el('span', 'pagou-rot', `Você pagou ${formatarValor(pagou * b.r)}`);
        // em cima da linha; se a linha está no topo do gráfico, embaixo dela
        const alto = (1 - (pagou - min) / Math.max(max - min, 1e-9)) * 100;
        rot.style.top = alto < 18 ? `calc(${alto}% + 6px)` : `calc(${alto}% - 22px)`;
        graf.append(rot);
      }
      d.append(graf);
      // os números
      const info = el('div', 'bolsa-info');
      const caixa = (rot: string, valor: string, cls = '') => {
        const c = el('div');
        c.append(el('span', 'sub', rot), el('b', cls, valor));
        info.append(c);
      };
      caixa('Você tem', `${tem} de ${m.limite}`);
      caixa('Pagou em média', p ? formatarValor((p.custo / p.qtd) * b.r) : '—');
      caixa('Vale agora', p ? formatarValor(p.qtd * m.valor * b.r) : '—');
      const l = p ? lucro(m.valor, p) : null;
      caixa('Lucro', l === null ? '—' : `${pct(l)}`, l === null ? '' : classeVar(l));
      d.append(info);
      // de onde vem o limite: o gerador ligado (com o ícone dele) e o Escritório
      const conta = el('div', 'conta-limite');
      const icone = el('span', 'mini-gerador');
      icone.setAttribute('aria-hidden', 'true');
      icone.style.backgroundImage = `url(${ativos.gerador(e.gerador)})`;
      conta.append(icone, el('span', undefined, contaLimite(m.id, m.limite, b.escritorio)));
      // comprar, vender e os lotes do Vorcaro
      const negocia = el('div', 'bolsa-negocia');
      const unidade = m.valor * b.r * (1 + b.corretagem);
      const cabe = m.limite - tem;
      const comprar = el('div', 'bts comprar');
      comprar.append(el('div', 'rot2', `Comprar (+${(b.corretagem * 100).toLocaleString('pt-BR')}% de corretagem)${alavanca > 1 ? ` · entram alavancadas ×${alavanca.toLocaleString('pt-BR')} (Vorcaro)` : ''}`));
      for (const [q, n] of [[1, 1], [10, 10], [0, 1]] as const) {
        const bt = button(q === 0 ? 'Máx' : String(q), 'btn compra', () => a.negociar(m.id, 'comprar', q, b.tick));
        bt.disabled = ocupado || cabe < n || maxCompra(valuation, m.valor, b.r, m.limite, tem, b.corretagem) < n;
        if (!ocupado && cabe >= n) precos.push({ botao: bt, preco: n * unidade }); // no limite fica apagado
        comprar.append(bt);
      }
      const vender = el('div', 'bts vender');
      vender.append(el('div', 'rot2', 'Vender'));
      for (const q of [1, 10, 0] as const) {
        const bt = button(q === 0 ? 'Tudo' : String(q), 'btn', () => a.negociar(m.id, 'vender', q, b.tick));
        bt.disabled = ocupado || (p?.qtd ?? 0) < (q === 10 ? 10 : 1);
        vender.append(bt);
      }
      negocia.append(comprar, vender);
      for (const lt of lotes(m.id)) {
        const L = lt.alavanca ?? 1;
        const compra = lt.custo / lt.qtd;
        const por = Math.max(0, compra + L * (m.valor - compra));
        const bl = el('div', 'bts vender lote');
        bl.dataset.alavanca = String(L);
        bl.append(el('div', 'rot2', `Alavancadas ×${L.toLocaleString('pt-BR')} · ${acoes(lt.qtd)} · pagou ${formatarValor(compra * b.r)} · vale ${formatarValor(lt.qtd * por * b.r)}`));
        for (const q of [1, 10, 0] as const) {
          const bt = button(q === 0 ? 'Tudo' : String(q), 'btn', () => a.negociar(m.id, 'vender', q, b.tick, L));
          bt.disabled = ocupado || lt.qtd < (q === 10 ? 10 : 1);
          bl.append(bt);
        }
        negocia.append(bl);
      }
      d.append(negocia, conta);
    }
    // as melhorias da Bolsa: o nível atual e o botão do próximo (preço em segundos × r)
    const melhorias = el('div', 'bolsa-melhorias');
    for (const tipo of ['corretor', 'escritorio'] as const) {
      const nivel = tipo === 'corretor' ? b.corretor : b.escritorio;
      const atual = melhoriaAtual(tipo, nivel);
      const card = el('div', 'melhoria-bolsa');
      card.dataset.tipo = tipo;
      const txt = el('div', 'meio');
      txt.append(el('strong', undefined, atual.nome), el('span', 'sub', atual.efeito));
      card.append(txt);
      const prox = proximaMelhoria(tipo, nivel);
      if (!prox) card.append(el('span', 'no-feito', 'No máximo'));
      else {
        const custo = prox.segundos * b.r;
        const bt = button(`${prox.nome} · ${formatarValor(custo)}`, 'btn', () => a.melhorar(tipo, prox.nivel));
        bt.setAttribute('aria-label', `Comprar ${prox.nome}: ${prox.efeito}, ${formatarValor(custo)}`);
        bt.disabled = ocupado || custo > valuation;
        if (!ocupado) precos.push({ botao: bt, preco: custo });
        card.append(bt);
      }
      melhorias.append(card);
    }
    dir.append(d, melhorias);
    raiz.append(esq, dir);
    d.scrollTop = rolouDetalhe;
    lista.scrollTop = rolouLista;
    if (focoEmpresa) lista.querySelector<HTMLElement>(`.acao[data-empresa="${focoEmpresa}"]`)?.focus({ preventScroll: true });
    atuais = precos;
  }
  /** Os botões que o F$ acende e apaga (vazio com a Bolsa fora da tela). */
  const precosAtuais = () => (raiz.isConnected ? atuais : []);

  return { elemento: raiz, renderizar, relogio, precos: precosAtuais };
}
