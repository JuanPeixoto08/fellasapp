// Tela da Horta (DOM): o resumo dos bônus, a grade de canteiros (do tamanho dos Food trucks), o cartão do canteiro
// escolhido (plantar / colher / arrancar) e a coleção com as dicas. Quem decide é o banco; aqui só mostra e chama.
import { button, el } from '../shared/hud/hud';
import type { HortaEstado } from '../shared/types';
import { formatarValor } from './formatar';
import { daPlanta, dica, ESPECIES, falta, fase, GRADE, madura, precoSemente, proximoLado, resumoBonus, type Especie } from './horta';
import { iconePlanta } from './hortaArte';

type Precos = { botao: HTMLButtonElement; preco: number };
const NOME_FASE = { muda: 'muda', crescendo: 'crescendo', madura: 'madura', murchando: 'murchando', morta: 'morta' } as const;

/** "45 min", "5 h", "2 h 10 min". */
function tempo(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h} h ${resto} min` : `${h} h`;
}
/** O bônus de uma espécie em texto curto ("produção +3% · geradores −2%"). */
function efeitos(e: Especie): string {
  return resumoBonus(e).replace('Nada madura ainda', '');
}

export function criarHortaTela(a: { plantar(canteiro: number, especie: number): void; colher(canteiro: number): void; arrancar(canteiro: number): void }) {
  const raiz = el('div', 'horta');
  let escolhido: number | null = null;
  let ultimo: [HortaEstado | null, number, number, boolean, number] | null = null;
  let atuais: Precos[] = [];

  function renderizar(h: HortaEstado | null, taxa: number, valuation: number, ocupado: boolean, agoraMs: number): void {
    ultimo = [h, taxa, valuation, ocupado, agoraMs];
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

    const topo = el('div', 'horta-topo');
    topo.append(el('h3', 'horta-titulo', 'Horta do Food truck'), el('span', 'horta-bonus', resumoBonus(h.bonus)));

    const grade = el('div', 'horta-grade');
    grade.style.setProperty('--lado', String(h.lado));
    for (let lin = 0; lin < h.lado; lin++) {
      for (let col = 0; col < h.lado; col++) {
        const c = lin * GRADE + col;
        const p = plantaEm(c);
        const n = lin * h.lado + col + 1;
        const b = button('', `canteiro${escolhido === c ? ' escolhido' : ''}`, () => {
          escolhido = escolhido === c ? null : c;
          if (ultimo) renderizar(...ultimo);
        });
        b.dataset.canteiro = String(c);
        b.setAttribute('aria-pressed', String(escolhido === c));
        if (p) {
          const e = daPlanta(p);
          const f = fase(e, Date.parse(p.inicio), agoraMs);
          b.append(iconePlanta(p.especie, f));
          b.classList.add(`fase-${f}`);
          b.setAttribute('aria-label', `Canteiro ${n}: ${e.nome}, ${NOME_FASE[f]}`);
        } else b.setAttribute('aria-label', `Canteiro ${n}: vazio`);
        grade.append(b);
      }
    }
    const prox = proximoLado(h.lado);
    const linhaProx = el('p', 'horta-prox', prox === null ? 'Horta no tamanho máximo' : `${h.lado + 1} × ${h.lado + 1} com ${prox} Food trucks (tem ${h.food_trucks})`);

    const cartao = el('div', 'horta-cartao');
    const precos: Precos[] = [];
    if (escolhido !== null) {
      const p = plantaEm(escolhido);
      if (!p) {
        cartao.append(el('p', 'rot', 'Plantar'));
        const lista = el('div', 'sementes');
        for (const e of ESPECIES.filter((x) => h.descobertas.includes(x.id))) {
          const preco = precoSemente(e, taxa);
          const b = button('', 'btn semente', () => a.plantar(escolhido!, e.id));
          b.dataset.especie = String(e.id);
          const meio = el('span', 'meio');
          meio.append(el('strong', undefined, e.nome), el('span', 'sub', `${efeitos(e)} · ${formatarValor(preco)}`));
          b.append(iconePlanta(e.id), meio);
          b.disabled = ocupado || preco > valuation;
          if (!ocupado) precos.push({ botao: b, preco });
          lista.append(b);
        }
        cartao.append(lista);
      } else {
        const e = daPlanta(p);
        const f = fase(e, Date.parse(p.inicio), agoraMs);
        const r = falta(e, Date.parse(p.inicio), agoraMs);
        const cab = el('div', 'cab');
        const meio = el('span', 'meio');
        meio.append(
          el('strong', undefined, e.nome),
          el('span', 'sub', `${NOME_FASE[f][0].toUpperCase()}${NOME_FASE[f].slice(1)} · ${r.ate === 'amadurecer' ? 'amadurece em' : 'morre em'} ${tempo(r.ms)}`),
          el('span', 'sub', efeitos(e)),
        );
        cab.append(iconePlanta(p.especie, f), meio);
        const bts = el('div', 'bts-horta');
        const col = button('Colher', 'btn main', () => a.colher(p.canteiro));
        col.disabled = ocupado || !madura(f);
        const arr = button('Arrancar', 'btn', () => a.arrancar(p.canteiro));
        arr.disabled = ocupado;
        bts.append(col, arr);
        cartao.append(cab, bts);
      }
    } else cartao.append(el('p', 'sub', 'Toca num canteiro pra plantar ou ver a planta.'));

    const colecao = el('div', 'horta-colecao');
    colecao.append(el('div', 'horta-colecao-cab', `Coleção ${h.descobertas.length}/${ESPECIES.length}`));
    const itens = el('div', 'colecao-itens');
    for (const e of ESPECIES) {
      const tem = h.descobertas.includes(e.id);
      const item = el('div', `colecao-item${tem ? '' : ' escondida'}`);
      if (tem) item.append(iconePlanta(e.id), el('span', undefined, e.nome));
      else {
        const d = dica(e, h.descobertas);
        item.append(el('span', 'interrogacao', '???'));
        if (d) item.append(el('span', 'sub', d));
      }
      itens.append(item);
    }
    colecao.append(itens);

    raiz.append(topo, grade, linhaProx, cartao, colecao);
    atuais = precos;
  }

  return {
    elemento: raiz,
    renderizar,
    /** Os botões que o F$ acende e apaga (vazio com a horta fora da tela). */
    precos: () => (raiz.isConnected ? atuais : []),
  };
}
