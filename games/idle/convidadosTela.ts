// Tela dos Convidados (DOM): o estúdio do PPP Podcast com as 3 cadeiras (retrato, efeito na cadeira, ao vivo), as
// trocas e a lista dos 11 pra escolher. Quem decide é o banco; aqui só mostra e chama.
import { button, el } from '../shared/hud/hud';
import type { IdleState } from '../shared/types';
import { ativos } from './ativos';
import {
  ABRE_COM, aoVivo, CONVIDADOS, convidado, DA_CADEIRA, destrancada, efeitosTexto, GEMAPLYS, MAX_TROCAS, MCVV, NOME_CADEIRA, PESOS,
  trocasAgora, type Cadeiras,
} from './convidados';
import type { Dica } from './dica';

type Ligar = (alvo: HTMLElement, chave: string, conteudo: () => Dica | null) => void;
const SEM: Cadeiras = { cadeira: [null, null, null], desde: [null, null, null], trocas: MAX_TROCAS, trocas_t: null };
const pct = (p: number) => `${Math.round(p * 100)}%`;

function tempo(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

function retrato(id: number, cls = 'conv-retrato'): HTMLElement {
  const r = el('div', cls);
  const url = ativos.convidado(id);
  if (url) r.style.backgroundImage = `url(${url})`;
  return r;
}

/** O que a caixinha de um convidado diz numa cadeira de peso p. */
export function dicaConvidado(id: number, p: number, cadeira: number | null, viva: string | null): Dica {
  const [bonus, defeito] = efeitosTexto(id, p || PESOS[0]);
  const linhas: Dica['linhas'] = [{ texto: convidado(id).bordao, tom: 'fraco' }];
  linhas.push({ texto: bonus, tom: 'bom' }, { texto: defeito, tom: 'ruim' });
  if (viva) linhas.push({ texto: viva });
  linhas.push({ texto: cadeira === null ? 'Valores na cadeira da frente' : `Na cadeira ${DA_CADEIRA[cadeira]} (${pct(PESOS[cadeira])})`, tom: 'fraco' });
  return { titulo: convidado(id).nome, linhas };
}

export function criarConvidadosTela(a: { sentar(cadeira: number, id: number): void; tirar(cadeira: number): void }, ligar: Ligar = () => undefined) {
  const raiz = el('div', 'convidados');
  let escolhendo: number | null = null;
  let ultimo: [IdleState, boolean, number] | null = null;
  const refazer = () => ultimo && renderizar(...ultimo);

  function renderizar(s: IdleState, ocupado: boolean, agoraMs: number): void {
    ultimo = [s, ocupado, agoraMs];
    raiz.replaceChildren();
    const ppp = s.generators[12] ?? 0;
    if (ppp < 1) {
      raiz.append(el('p', 'vazio', 'Compra 1 PPP Podcast pra abrir o estúdio.'));
      return;
    }
    const c: Cadeiras = s.convidados ?? SEM;
    const tr = trocasAgora(c, agoraMs);

    const topo = el('div', 'conv-topo');
    topo.append(el('h3', 'conv-titulo', 'PPP Podcast'),
      el('span', 'conv-trocas', `Trocas: ${tr.trocas}/${MAX_TROCAS}${tr.proximaMs ? ` · próxima em ${tempo(tr.proximaMs - agoraMs)}` : ''}`));

    const estudio = el('div', 'conv-estudio');
    for (let i = 0; i < 3; i++) {
      const aberta = destrancada(i, ppp);
      const id = c.cadeira[i];
      const cad = el('div', `conv-cadeira${i === 0 ? ' frente' : ''}${aberta ? '' : ' trancada'}${escolhendo === i ? ' escolhendo' : ''}`);
      cad.append(el('span', 'conv-rotulo', `${NOME_CADEIRA[i][0].toUpperCase()}${NOME_CADEIRA[i].slice(1)} · ${pct(PESOS[i])}`));
      if (!aberta) {
        cad.append(el('span', 'sub', `Abre com ${ABRE_COM[i]} PPP Podcasts${id ? ` (${convidado(id).nome} esperando)` : ''}`));
      } else if (id) {
        const desde = c.desde[i] ? Date.parse(c.desde[i]!) : agoraMs;
        const viva = aoVivo(id, PESOS[i], desde, s.user_id, agoraMs);
        const [bonus, defeito] = efeitosTexto(id, PESOS[i]);
        const meio = el('div', 'meio');
        meio.append(el('strong', undefined, convidado(id).nome), el('span', 'bom', bonus), el('span', 'ruim', defeito));
        if (viva) meio.append(el('span', 'sub vivo-conv', viva));
        const bts = el('div', 'bts-conv');
        const trocar = button('Trocar', 'btn compacto', () => { escolhendo = escolhendo === i ? null : i; refazer(); });
        trocar.disabled = ocupado;
        const tirar = button('Tirar', 'btn compacto', () => a.tirar(i));
        tirar.disabled = ocupado;
        bts.append(trocar, tirar);
        cad.append(retrato(id), meio, bts);
        cad.tabIndex = 0;
        ligar(cad, `cadeira${i}`, () => dicaConvidado(id, PESOS[i], i, viva));
      } else {
        const b = button('Chamar convidado', 'btn main compacto', () => { escolhendo = escolhendo === i ? null : i; refazer(); });
        b.disabled = ocupado || tr.trocas < 1;
        cad.append(el('div', 'conv-retrato vazio'), b);
      }
      estudio.append(cad);
    }

    raiz.append(topo, estudio);
    if (escolhendo !== null && destrancada(escolhendo, ppp)) {
      const ch = escolhendo;
      const lista = el('div', 'conv-lista');
      const cab = el('div', 'conv-lista-cab');
      cab.append(el('strong', undefined, `Quem senta na cadeira ${DA_CADEIRA[ch]}?`), button('Cancelar', 'btn compacto', () => { escolhendo = null; refazer(); }));
      lista.append(cab);
      if (tr.trocas < 1) lista.append(el('p', 'sub', `Sem trocas agora. A próxima volta em ${tempo((tr.proximaMs ?? agoraMs) - agoraMs)}.`));
      for (const cv of CONVIDADOS) {
        const onde = c.cadeira.indexOf(cv.id);
        const item = el('div', 'conv-item');
        const [bonus, defeito] = efeitosTexto(cv.id, PESOS[ch]);
        const meio = el('div', 'meio');
        meio.append(el('strong', undefined, cv.nome), el('span', 'sub', cv.bordao), el('span', 'bom', bonus), el('span', 'ruim', defeito));
        const mesma = (cv.id === GEMAPLYS && c.cadeira.some((x, j) => x === MCVV && j !== ch))
          || (cv.id === MCVV && c.cadeira.some((x, j) => x === GEMAPLYS && j !== ch));
        let b: HTMLElement;
        if (onde >= 0) b = el('span', 'conv-ja', onde === ch ? 'Nesta cadeira' : `Na cadeira ${DA_CADEIRA[onde]}`);
        else {
          const bt = button('Sentar', 'btn main compacto', () => { escolhendo = null; a.sentar(ch, cv.id); });
          bt.disabled = ocupado || (tr.trocas < 1 && !mesma);
          b = bt;
        }
        item.append(retrato(cv.id, 'conv-retrato mini'), meio, b);
        item.dataset.convidado = String(cv.id);
        ligar(item, `conv${cv.id}`, () => dicaConvidado(cv.id, PESOS[ch], ch, null));
        lista.append(item);
      }
      raiz.append(lista);
    }
  }

  return {
    elemento: raiz,
    renderizar,
    /** Fecha a lista de escolha (ex.: depois de sentar). */
    fecharLista() { escolhendo = null; },
  };
}
