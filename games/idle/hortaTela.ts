// Tela da Horta em tela cheia (DOM; mockup de 12/10): à esquerda os bônus agora, o tamanho da horta, os convidados que
// mexem nela e a coleção; no meio a grade 6 × 6 (as que ainda não abriram com cadeado); à direita o canteiro escolhido
// (colher / arrancar) e as sementes. Quem decide é o banco; aqui só mostra e chama.
import { button, el } from '../shared/hud/hud';
import type { HortaEstado } from '../shared/types';
import { ativos } from './ativos';
import { formatarValor } from './formatar';
import { daPlanta, destrancado, dica, ESPECIES, falta, fase, GRADE, madura, precoSemente, proximoLado, resumoBonus, type Especie } from './horta';
import { iconePlanta } from './hortaArte';

type Precos = { botao: HTMLButtonElement; preco: number };
/** Um convidado sentado que mexe na horta (o Terry, o Viniccius13), pra mostrar do lado. */
export type ChipHorta = { retrato: string | null; titulo: string; bonus: string; defeito: string };
const NOME_FASE = { muda: 'Muda', crescendo: 'Crescendo', madura: 'Madura', murchando: 'Murchando', morta: 'Morta' } as const;
/** O nome que cabe no quadradinho da coleção. */
const NOME_CURTO: Record<number, string> = { 1: 'Pé de Pix', 2: 'Couve', 3: 'Mandioca', 4: 'Inhame', 5: 'Coentro', 6: 'Abacate', 7: 'Quiabo', 8: 'Morango' };
/** Quantos Food trucks abriram o lado atual (pra barra do tamanho). */
const ABRIU_COM: Record<number, number> = { 2: 1, 3: 25, 4: 50, 5: 100, 6: 200 };

/** "45 min", "5 h", "2 h 10 min". */
function tempo(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h} h ${resto} min` : `${h} h`;
}
/** O bônus de uma espécie em texto curto ("Produção +2% · Geradores 2% mais baratos"), × o Agrotóxico liberado (`mult`). */
const efeitos = (e: Especie, mult: number) =>
  resumoBonus({ producao: e.producao * mult, geradores: e.geradores * mult, melhorias: e.melhorias * mult, oportunidades: e.oportunidades * mult });
const pct = (x: number) => `${(Math.round(Math.abs(x) * 1000) / 10).toLocaleString('pt-BR')}%`;

function barra(fracao: number): HTMLElement {
  const b = el('div', 'horta-barra');
  const i = el('i');
  i.style.width = `${Math.round(Math.max(0, Math.min(1, fracao)) * 100)}%`;
  b.append(i);
  return b;
}

export function criarHortaTela(a: { plantar(canteiro: number, especie: number): void; colher(canteiro: number): void; arrancar(canteiro: number): void }) {
  const raiz = el('div', 'horta');
  let escolhido = 0;
  let ultimo: Parameters<typeof renderizar> | null = null;
  let atuais: Precos[] = [];

  /** `mult` = o Agrotóxico liberado da árvore (1,5): os bônus de cada espécie aparecem já multiplicados. */
  function renderizar(
    h: HortaEstado | null, taxa: number, valuation: number, ocupado: boolean, agoraMs: number, chips: readonly ChipHorta[] = [], mult = 1,
  ): void {
    ultimo = [h, taxa, valuation, ocupado, agoraMs, chips, mult];
    raiz.replaceChildren();
    atuais = [];
    if (!h) {
      raiz.append(el('p', 'vazio', 'Carregando a horta…'));
      return;
    }
    if (h.lado === 0) {
      raiz.append(el('p', 'vazio', 'Compra 1 Food truck pra abrir a horta.'));
      return;
    }
    const plantaEm = (c: number) => h.plantas.find((p) => p.canteiro === c);
    /** O número do canteiro como a pessoa conta (1, 2, 3… dentro do lado atual). */
    const numero = (c: number) => Math.floor(c / GRADE) * h.lado + (c % GRADE) + 1;
    if (!destrancado(escolhido, h.lado)) escolhido = 0;
    const prox = proximoLado(h.lado);

    // ----- à esquerda: bônus agora, tamanho, convidados e coleção -----
    const esq = el('div', 'horta-esq');
    const bonus = el('div', 'horta-bloco horta-bonus-agora');
    bonus.append(el('span', 'rot2', 'Bônus agora'));
    const b = h.bonus;
    for (const [rot, valor] of [
      ['Produção', b.producao ? `${b.producao > 0 ? '+' : '−'}${pct(b.producao)}` : null],
      ['Geradores', b.geradores ? `${pct(b.geradores)} mais baratos` : null],
      ['Melhorias', b.melhorias ? `${pct(b.melhorias)} mais baratas` : null],
      ['Oportunidades', b.oportunidades ? `+${pct(b.oportunidades)}` : null],
    ] as const) {
      const l = el('div', 'linha-bonus');
      l.append(el('span', undefined, rot), el('b', valor ? (b.producao < 0 && rot === 'Produção' ? 'cai' : '') : 'nada', valor ?? '—'));
      bonus.append(l);
    }
    const tam = el('div', 'horta-bloco');
    const linhaT = el('div', 'linha-bonus');
    linhaT.append(el('span', undefined, `${h.lado} × ${h.lado} agora`), el('span', 'sub', prox === null ? 'Tamanho máximo' : `${h.lado + 1} × ${h.lado + 1} com ${prox} Food trucks`));
    const de = ABRIU_COM[h.lado] ?? 0;
    tam.append(el('span', 'rot2', 'Tamanho da horta'), linhaT, barra(prox === null ? 1 : (h.food_trucks - de) / (prox - de)),
      el('p', 'horta-prox', prox === null ? 'Horta no tamanho máximo' : `Tem ${h.food_trucks} Food trucks · faltam ${prox - h.food_trucks}`));
    esq.append(bonus, tam);
    for (const c of chips) {
      const chip = el('div', 'horta-bloco horta-chip');
      const r = el('span', 'horta-chip-retrato');
      if (c.retrato) r.style.backgroundImage = `url(${c.retrato})`;
      const t = el('div', 'meio');
      t.append(el('strong', undefined, c.titulo), el('span', 'bom', c.bonus), el('span', 'ruim', c.defeito));
      chip.append(r, t);
      esq.append(chip);
    }
    const colecao = el('div', 'horta-bloco horta-colecao');
    colecao.append(el('div', 'horta-colecao-cab', `Coleção ${h.descobertas.length}/${ESPECIES.length}`));
    const itens = el('div', 'colecao-itens');
    const dicas = el('div', 'horta-dicas');
    for (const e of ESPECIES) {
      const tem = h.descobertas.includes(e.id);
      const item = el('div', `colecao-item${tem ? '' : ' escondida'}`);
      item.append(iconePlanta(e.id), el('span', 'nome', tem ? NOME_CURTO[e.id] : '???'));
      if (tem) item.title = e.nome;
      else {
        const d = dica(e, h.descobertas);
        if (d) {
          item.title = d;
          dicas.append(el('p', 'sub', `???: ${d}`));
        }
      }
      itens.append(item);
    }
    colecao.append(itens, dicas);
    esq.append(colecao);

    // ----- no meio: a grade 6 × 6 -----
    const centro = el('div', 'horta-centro');
    const grade = el('div', 'horta-grade');
    const cadeado = ativos.estudio('cadeado');
    for (let lin = 0; lin < GRADE; lin++) {
      for (let col = 0; col < GRADE; col++) {
        const c = lin * GRADE + col;
        if (!destrancado(c, h.lado)) {
          const t = el('div', 'canteiro tranc');
          t.setAttribute('aria-hidden', 'true');
          if (cadeado) t.style.backgroundImage = `url(${cadeado})`;
          grade.append(t);
          continue;
        }
        const p = plantaEm(c);
        const bt = button('', `canteiro${escolhido === c ? ' escolhido' : ''}`, () => {
          escolhido = c;
          if (ultimo) renderizar(...ultimo);
        });
        bt.dataset.canteiro = String(c);
        bt.setAttribute('aria-pressed', String(escolhido === c));
        if (p) {
          const e = daPlanta(p);
          const f = fase(e, Date.parse(p.inicio), agoraMs);
          bt.append(iconePlanta(p.especie, f));
          bt.classList.add(`fase-${f}`);
          if (madura(f)) bt.classList.add('madura');
          bt.setAttribute('aria-label', `Canteiro ${numero(c)}: ${e.nome}, ${NOME_FASE[f].toLowerCase()}`);
        } else bt.setAttribute('aria-label', `Canteiro ${numero(c)}: vazio`);
        grade.append(bt);
      }
    }
    const legenda = el('div', 'horta-legenda');
    const itensLegenda: [string, string][] = [['madura', 'Madura (dá bônus)'], ['escolhido', 'Escolhido']];
    if (prox !== null) itensLegenda.push(['tranc', `Abre com ${prox} Food trucks`]);
    for (const [cls, t] of itensLegenda) {
      const s = el('span');
      s.append(el('i', cls), document.createTextNode(t));
      legenda.append(s);
    }
    centro.append(grade, legenda);

    // ----- à direita: o canteiro escolhido e as sementes -----
    const dir = el('div', 'horta-dir');
    const cartao = el('div', 'horta-cartao');
    const p = plantaEm(escolhido);
    if (p) {
      const e = daPlanta(p);
      const f = fase(e, Date.parse(p.inicio), agoraMs);
      const r = falta(e, Date.parse(p.inicio), agoraMs);
      const cab = el('div', 'cab');
      const meio = el('span', 'meio');
      const quanto = f === 'morta' ? 'Morta · arranca pra plantar de novo' : `${NOME_FASE[f]} · ${r.ate === 'amadurecer' ? 'amadurece em' : 'morre em'} ${tempo(r.ms)}`;
      meio.append(el('strong', undefined, e.nome), el('span', 'bom', efeitos(e, mult)), el('span', 'sub', quanto),
        barra(r.ate === 'amadurecer' ? 1 - r.ms / (e.amadureceS * 1000) : r.ms / (e.vidaS * 1000)));
      cab.append(iconePlanta(p.especie, f), meio);
      const bts = el('div', 'bts-horta');
      const col = button('Colher', 'btn main', () => a.colher(p.canteiro));
      col.disabled = ocupado || !madura(f);
      const arr = button('Arrancar', 'btn', () => a.arrancar(p.canteiro));
      arr.disabled = ocupado;
      bts.append(col, arr);
      cartao.append(cab, bts);
    } else {
      const meio = el('span', 'meio');
      meio.append(el('strong', undefined, `Canteiro ${numero(escolhido)} vazio`), el('span', 'sub', 'Escolhe uma semente aqui embaixo pra plantar nele.'));
      cartao.append(meio);
    }
    // a semente vai no canteiro escolhido se ele está vazio; senão, no 1º vazio
    let alvo: number | null = p ? null : escolhido;
    for (let c = 0; alvo === null && c < GRADE * GRADE; c++) if (destrancado(c, h.lado) && !plantaEm(c)) alvo = c;
    const sementes = el('div', 'horta-sementes');
    sementes.append(el('span', 'rot2', alvo === null ? 'Sem canteiro vazio pra plantar' : `Plantar no canteiro ${numero(alvo)}${p ? ' (o primeiro vazio)' : ''}`));
    const lista = el('div', 'sementes');
    const precos: Precos[] = [];
    for (const e of ESPECIES.filter((x) => h.descobertas.includes(x.id))) {
      const preco = precoSemente(e, taxa);
      const bt = button('', 'btn semente', () => { if (alvo !== null) a.plantar(alvo, e.id); });
      bt.dataset.especie = String(e.id);
      const meio = el('span', 'meio');
      meio.append(el('strong', undefined, e.nome), el('span', 'bom', efeitos(e, mult)));
      bt.append(iconePlanta(e.id), meio, el('span', 'preco-semente', formatarValor(preco)));
      bt.disabled = ocupado || alvo === null || preco > valuation;
      if (!ocupado && alvo !== null) precos.push({ botao: bt, preco });
      lista.append(bt);
    }
    sementes.append(lista);
    dir.append(cartao, sementes);

    raiz.append(esq, centro, dir);
    atuais = precos;
  }

  return {
    elemento: raiz,
    renderizar,
    /** Os botões que o F$ acende e apaga (vazio com a horta fora da tela). */
    precos: () => (raiz.isConnected ? atuais : []),
  };
}
