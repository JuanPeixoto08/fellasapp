// Tela da Bolsa (lista + detalhe), em DOM puro. No PC fica no corpo da gaveta Bolsa; no celular a bancada inteira vira
// tela cheia (CSS). O detalhe aparece com uma empresa escolhida (tocar de novo fecha). Texto sempre por textContent.
import { button, el } from '../shared/hud/hud';
import type { BolsaEstado, BolsaPosicao, LadoBolsa, MelhoriaBolsa } from '../shared/types';
import { acoes, empresa, lucro, maxCompra, melhoriaAtual, pct, proximaMelhoria, textoQuebra, variacao } from './bolsa';
import { formatarValor } from './formatar';

const NS = 'http://www.w3.org/2000/svg';
type Precos = { botao: HTMLButtonElement; preco: number };

/** Barras da última hora; a última verde se subiu, vermelha se caiu. */
function grafico(cls: string, h: number[]) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${Math.max(1, h.length) * 2} 100`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('shape-rendering', 'crispEdges');
  const max = Math.max(...h, 1e-9);
  const min = Math.min(...h, max);
  const sobe = h.length > 1 && h[h.length - 1] >= h[h.length - 2];
  h.forEach((v, i) => {
    const alt = 8 + ((v - min) / Math.max(max - min, 1e-9)) * 92;
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', String(i * 2));
    r.setAttribute('y', String(100 - alt));
    r.setAttribute('width', '1.6');
    r.setAttribute('height', String(alt));
    r.setAttribute('class', i === h.length - 1 ? (sobe ? 'barra sobe' : 'barra cai') : 'barra');
    svg.append(r);
  });
  return svg;
}

const classeVar = (x: number) => (x > 0.0005 ? 'sobe' : x < -0.0005 ? 'cai' : '');

export function criarBolsaTela(a: {
  negociar(empresa: number, lado: LadoBolsa, qtd: 0 | 1 | 10, tick: number): void;
  melhorar(tipo: MelhoriaBolsa, nivel: number): void;
}) {
  const raiz = el('div', 'bolsa');
  let escolhida: number | null = null;
  let ultimo: [BolsaEstado | null, number, boolean] | null = null;

  let relogioEl: HTMLElement | null = null;
  /** "preço novo em m:ss" do detalhe aberto, chamado pela página enquanto o minuto corre. */
  function relogio(ms: number) {
    if (!relogioEl) return;
    const s = Math.max(0, Math.ceil(ms / 1000));
    relogioEl.textContent = `preço novo em ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function renderizar(b: BolsaEstado | null, valuation: number, ocupado: boolean): Precos[] {
    ultimo = [b, valuation, ocupado];
    raiz.replaceChildren();
    relogioEl = null;
    if (!b) {
      raiz.append(el('p', 'vazio', 'Carregando a Bolsa…'));
      return [];
    }
    if (!b.aberta) {
      raiz.append(el('p', 'vazio', 'Compra 1 Grupo de trader pra abrir a Bolsa.'));
      return [];
    }
    const pos = (id: number): BolsaPosicao | undefined => b.carteira.find((p) => p.empresa === id);

    const topo = el('div', 'bolsa-topo');
    const valorTotal = b.carteira.reduce((s, p) => s + p.qtd * (b.empresas.find((e) => e.id === p.empresa)?.valor ?? 0), 0) * b.r;
    const lucroTotal = valorTotal - b.carteira.reduce((s, p) => s + p.custo, 0) * b.r;
    const cart = el('div', 'carteira');
    const c1 = el('span');
    c1.append('Carteira ', el('b', undefined, formatarValor(valorTotal)));
    const c2 = el('span');
    c2.append('Lucro ', el('b', classeVar(lucroTotal), `${lucroTotal >= 0 ? '+' : '−'}${formatarValor(Math.abs(lucroTotal))}`));
    cart.append(c1, c2);
    topo.append(el('h3', 'bolsa-titulo', 'Bolsa da Faria Lima'), cart);

    // melhorias da Bolsa: o nível atual e o botão do próximo (preço em segundos × r)
    const melhorias = el('div', 'bolsa-melhorias');
    const precos: Precos[] = [];
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

    const lista = el('div', 'bolsa-lista');
    for (const m of b.empresas) {
      const e = empresa(m.id);
      const p = pos(m.id);
      const li = button('', `acao${escolhida === m.id ? ' escolhida' : ''}${m.rj_ate !== null ? ' quebrada' : ''}`, () => {
        escolhida = escolhida === m.id ? null : m.id;
        if (ultimo) renderizar(...ultimo);
      });
      li.dataset.empresa = String(m.id);
      li.setAttribute('aria-pressed', String(escolhida === m.id));
      const nome = el('span', 'tk', e.codigo);
      nome.append(el('small', undefined, e.nome));
      if (m.rj_ate !== null) nome.append(el('span', 'etq rj', textoQuebra(m.rj_ate, b.tick)));
      else if (m.risco) nome.append(el('span', 'etq risco', 'Pode quebrar'));
      const preco = el('span', 'preco', m.rj_ate !== null ? '—' : formatarValor(m.valor * b.r));
      const v = variacao(m.historico);
      if (m.rj_ate === null) preco.append(el('small', classeVar(v.hora), `${pct(v.hora)} na hora`));
      const tem = el('span', 'tem');
      if (p) {
        const l = lucro(m.valor, p);
        tem.append(el('b', undefined, acoes(p.qtd)), el('span', classeVar(l), `${pct(l)} de lucro`));
      } else tem.textContent = m.rj_ate !== null ? '' : 'você não tem';
      li.append(nome, m.rj_ate !== null ? el('span') : grafico('mini', m.historico.slice(-30)), preco, tem);
      lista.append(li);
    }
    const miolo = el('div', 'bolsa-miolo');
    miolo.append(lista);
    raiz.append(topo, melhorias, miolo);

    const m = b.empresas.find((x) => x.id === escolhida);
    if (m) {
      const e = empresa(m.id);
      const p = pos(m.id);
      const tem = p?.qtd ?? 0;
      const d = el('div', 'bolsa-detalhe');
      d.setAttribute('aria-live', 'polite');
      const cab = el('div', 'cab');
      const nome = el('span', 'tk', e.codigo);
      nome.append(el('small', undefined, e.nome));
      relogioEl = el('span', 'sub');
      relogioEl.setAttribute('role', 'timer'); // timer não é anunciado a cada mudança (o detalhe é aria-live)
      relogio(b.vira_em_ms);
      cab.append(nome, relogioEl);
      d.append(cab);
      if (m.rj_ate !== null) {
        d.append(el('p', 'sub', textoQuebra(m.rj_ate, b.tick)));
      } else {
        const v = variacao(m.historico);
        const linhaPreco = el('div', 'preco-grande');
        linhaPreco.append(el('b', undefined, formatarValor(m.valor * b.r)), el('span', classeVar(v.minuto), ` ${pct(v.minuto)} no minuto · ${pct(v.hora)} na hora`));
        d.append(linhaPreco, grafico('graf', m.historico));
        const info = el('div', 'linha2');
        const i1 = el('span');
        i1.append('Você tem ', el('b', undefined, `${tem} de ${m.limite}`));
        info.append(i1);
        if (p) {
          const i2 = el('span');
          i2.append('Pagou em média ', el('b', undefined, formatarValor((p.custo / p.qtd) * b.r)));
          info.append(i2);
        }
        d.append(info);
        if (p) {
          const l2 = el('div', 'linha2');
          const i3 = el('span');
          i3.append('Vale agora ', el('b', undefined, formatarValor(p.qtd * m.valor * b.r)));
          const l = lucro(m.valor, p);
          l2.append(i3, el('span', classeVar(l), `${pct(l)} de lucro`));
          d.append(l2);
        }
        const unidade = m.valor * b.r * (1 + b.corretagem);
        const cabe = m.limite - tem;
        const comprar = el('div', 'bts comprar');
        comprar.append(el('div', 'rot2', `Comprar (+${(b.corretagem * 100).toLocaleString('pt-BR')}% de corretagem)`));
        for (const [q, n] of [[1, 1], [10, 10], [0, 1]] as const) {
          const bt = button(q === 0 ? 'Máx' : String(q), 'btn main', () => a.negociar(m.id, 'comprar', q, b.tick));
          bt.disabled = ocupado || cabe < n || maxCompra(valuation, m.valor, b.r, m.limite, tem, b.corretagem) < n;
          precos.push({ botao: bt, preco: n * unidade });
          comprar.append(bt);
        }
        const vender = el('div', 'bts vender');
        vender.append(el('div', 'rot2', 'Vender'));
        for (const q of [1, 10, 0] as const) {
          const bt = button(q === 0 ? 'Tudo' : String(q), 'btn', () => a.negociar(m.id, 'vender', q, b.tick));
          bt.disabled = ocupado || tem < (q === 10 ? 10 : 1);
          vender.append(bt);
        }
        d.append(comprar, vender, el('p', 'aviso', 'Preço em segundos da sua produção: quando ela cresce, o F$ sobe junto.'));
      }
      miolo.append(d);
    }
    // botões apagados por F$ não entram no atualizarValor (ficariam acesos sozinhos)
    return precos.filter((x) => !x.botao.disabled || x.preco <= valuation);
  }

  return { elemento: raiz, renderizar, relogio };
}
