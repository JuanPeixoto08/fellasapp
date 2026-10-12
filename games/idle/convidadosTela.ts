// Tela dos Convidados (DOM): o estúdio do PPP Podcast em pixel art (parede de espuma, neon, luz AO VIVO, bancada com
// os microfones) com os retratos nas 3 cadeiras; embaixo, um cartão por cadeira (efeito na cadeira, ao vivo, trocar e
// tirar); a escolha de convidado é uma tela de seleção de personagem. Quem decide é o banco; aqui só mostra e chama.
import { button, el } from '../shared/hud/hud';
import type { IdleState } from '../shared/types';
import { ativos } from './ativos';
import {
  ABRE_COM, aoVivo, CONVIDADOS, convidado, DA_CADEIRA, destrancada, efeitosTexto, MAX_TROCAS, NOME_CADEIRA, PESOS,
  trocasAgora, type Cadeiras,
} from './convidados';
import type { Dica } from './dica';

type Ligar = (alvo: HTMLElement, chave: string, conteudo: () => Dica | null) => void;
const SEM: Cadeiras = { cadeira: [null, null, null], desde: [null, null, null], trocas: MAX_TROCAS, trocas_t: null };
const pct = (p: number) => `${Math.round(p * 100)}%`;
/** Onde cada cadeira fica no estúdio (px da arte, 160 × 80): a da frente no meio, o meio à esquerda, o canto à direita. */
const LUGAR = [{ x: 64, placa: 56 }, { x: 16, placa: 8 }, { x: 112, placa: 104 }] as const;
const Y_RETRATO = 26;

function tempo(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
}
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

/** Uma peça da arte do estúdio na posição (x, y) da arte; o CSS multiplica pela escala (--esc). */
function peca(cls: string, url: string | null, x: number, y: number): HTMLElement {
  const e = el('div', cls);
  if (url) e.style.backgroundImage = `url(${url})`;
  e.style.setProperty('--x', String(x));
  e.style.setProperty('--y', String(y));
  return e;
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
  let marcado: number | null = null; // o convidado em destaque na seleção
  let recado: string | null = null; // "São a mesma pessoa?" (some no próximo toque)
  let ultimo: [IdleState, boolean, number] | null = null;
  const refazer = () => ultimo && renderizar(...ultimo);
  const escolher = (i: number) => {
    recado = null;
    escolhendo = i;
    marcado = null;
    refazer();
  };

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
    const algum = c.cadeira.some((id, i) => id && destrancada(i, ppp));
    if (escolhendo === null || !destrancada(escolhendo, ppp)) {
      const vazia = [0, 1, 2].find((i) => destrancada(i, ppp) && !c.cadeira[i]);
      escolhendo = vazia ?? 0;
    }

    // as trocas: o número, quando volta a próxima e uma fichinha por troca
    const topo = el('div', 'conv-topo');
    const txt = el('div', 'conv-trocas-txt');
    txt.append(el('span', 'conv-trocas', `Trocas: ${tr.trocas}/${MAX_TROCAS}${tr.proximaMs ? ` · próxima em ${tempo(tr.proximaMs - agoraMs)}` : ''}`));
    const fichas = el('div', 'conv-fichas');
    fichas.setAttribute('aria-hidden', 'true');
    for (let k = 0; k < MAX_TROCAS; k++) fichas.append(el('i', k < tr.trocas ? 'ficha' : 'ficha gasta'));
    topo.append(txt, fichas);

    // ----- o estúdio -----
    const estudio = el('div', `estudio${algum ? ' no-ar' : ''}`);
    estudio.setAttribute('role', 'group');
    estudio.setAttribute('aria-label', 'Estúdio do PPP Podcast');
    estudio.append(peca('estudio-fundo', ativos.estudio('fundo'), 0, 0));
    for (let i = 0; i < 3; i++) {
      const { x } = LUGAR[i];
      const aberta = destrancada(i, ppp);
      const id = c.cadeira[i];
      if (!aberta) {
        estudio.append(peca('estudio-retrato trancada', ativos.estudio('cadeira'), x, Y_RETRATO + 6));
        estudio.append(peca('estudio-cadeado', ativos.estudio('cadeado'), x + 8, Y_RETRATO + 8));
      } else if (id) estudio.append(peca(`estudio-retrato${i === 0 ? ' frente' : ''}`, ativos.convidado(id), x, Y_RETRATO));
      else estudio.append(peca('estudio-retrato vazia', ativos.estudio('cadeira'), x, Y_RETRATO + 6));
      if (aberta && id) {
        const eq = peca('estudio-eq', null, x + 30, Y_RETRATO + 10);
        for (let k = 0; k < 3; k++) eq.append(el('i'));
        estudio.append(eq);
      }
    }
    estudio.append(peca('estudio-aovivo', ativos.estudio('aovivo'), 0, 0), peca('estudio-frente', ativos.estudio('frente'), 0, 0));
    for (let i = 0; i < 3; i++) {
      const aberta = destrancada(i, ppp);
      const id = c.cadeira[i];
      const placa = peca(`estudio-placa${i === 0 ? ' frente' : ''}`, null, LUGAR[i].placa, 64);
      placa.textContent = !aberta ? `${ABRE_COM[i]} PPP` : id ? convidado(id).nome : 'Vazia';
      estudio.append(placa);
      // tocar no lugar abre a escolha daquela cadeira
      const alvo = button('', 'estudio-lugar', () => escolher(i));
      alvo.style.setProperty('--x', String(LUGAR[i].x));
      alvo.style.setProperty('--y', String(Y_RETRATO));
      alvo.setAttribute('aria-label', `Cadeira ${DA_CADEIRA[i]}: ${!aberta ? `abre com ${ABRE_COM[i]} PPP Podcasts` : id ? convidado(id).nome : 'vazia'}`);
      alvo.disabled = !aberta || ocupado;
      estudio.append(alvo);
    }

    // ----- os cartões das cadeiras -----
    const cartoes = el('div', 'conv-estudio');
    for (const i of [1, 0, 2]) {
      const aberta = destrancada(i, ppp);
      const id = c.cadeira[i];
      const cad = el('div', `conv-cadeira${i === 0 ? ' frente' : ''}${aberta ? '' : ' trancada'}${escolhendo === i ? ' escolhendo' : ''}`);
      cad.append(el('span', 'conv-rotulo', `${cap(NOME_CADEIRA[i])} · ${pct(PESOS[i])}`));
      if (!aberta) {
        cad.append(el('span', 'sub', `Abre com ${ABRE_COM[i]} PPP Podcasts${id ? ` (${convidado(id).nome} esperando)` : ''}`));
        if (id) {
          const tirar = button('Tirar', 'btn compacto', () => a.tirar(i));
          tirar.disabled = ocupado;
          cad.append(tirar);
        }
      } else if (id) {
        const desde = c.desde[i] ? Date.parse(c.desde[i]!) : agoraMs;
        const viva = aoVivo(id, PESOS[i], desde, s.user_id, agoraMs);
        const [bonus, defeito] = efeitosTexto(id, PESOS[i]);
        const meio = el('div', 'meio');
        meio.append(el('strong', undefined, convidado(id).nome), el('span', 'bom', bonus), el('span', 'ruim', defeito));
        if (viva) meio.append(el('span', 'sub vivo-conv', viva));
        const bts = el('div', 'bts-conv');
        const trocar = button('Trocar', 'btn compacto', () => escolher(i));
        trocar.disabled = ocupado;
        const tirar = button('Tirar', 'btn compacto', () => a.tirar(i));
        tirar.disabled = ocupado;
        bts.append(trocar, tirar);
        cad.append(meio, bts);
        cad.tabIndex = 0;
        ligar(cad, `cadeira${i}`, () => dicaConvidado(id, PESOS[i], i, viva));
      } else {
        const b = button('Chamar convidado', 'btn main compacto', () => escolher(i));
        b.disabled = ocupado || tr.trocas < 1;
        cad.append(el('span', 'sub', 'Cadeira vazia'), b);
      }
      cartoes.append(cad);
    }

    const esq = el('div', 'conv-esq');
    esq.append(...(recado ? [el('p', 'conv-recado', recado)] : []), estudio, cartoes);
    const dir = el('div', 'conv-dir');
    dir.append(topo);
    raiz.append(esq, dir);

    // ----- a seleção de convidado -----
    if (destrancada(escolhendo, ppp)) {
      const ch = escolhendo;
      const livres = CONVIDADOS.filter((cv) => !c.cadeira.includes(cv.id));
      const foco = marcado ?? livres[0]?.id ?? CONVIDADOS[0].id;
      const sel = el('div', 'conv-escolha');
      const cab = el('div', 'conv-lista-cab');
      cab.append(el('strong', undefined, `Quem senta na cadeira ${DA_CADEIRA[ch]}?`));
      sel.append(cab);
      if (tr.trocas < 1) sel.append(el('p', 'sub', `Sem trocas agora. A próxima volta em ${tempo((tr.proximaMs ?? agoraMs) - agoraMs)}.`));
      const grade = el('div', 'conv-grade');
      for (const cv of CONVIDADOS) {
        const onde = c.cadeira.indexOf(cv.id);
        const t = button('', `conv-tile${cv.id === foco ? ' marcado' : ''}${onde >= 0 ? ' sentado' : ''}`, () => { marcado = cv.id; refazer(); });
        t.dataset.convidado = String(cv.id);
        t.setAttribute('aria-pressed', String(cv.id === foco));
        t.append(peca('conv-tile-retrato', ativos.convidado(cv.id), 0, 0), el('span', 'conv-tile-nome', cv.nome));
        if (onde >= 0) t.append(el('span', 'conv-tile-onde', cap(NOME_CADEIRA[onde])));
        ligar(t, `conv${cv.id}`, () => dicaConvidado(cv.id, PESOS[ch], ch, null));
        grade.append(t);
      }
      sel.append(grade);
      // o destaque: retrato grande, bordão, efeito nesta cadeira e o Sentar
      const cv = convidado(foco);
      const onde = c.cadeira.indexOf(foco);
      const [bonus, defeito] = efeitosTexto(foco, PESOS[ch]);
      const det = el('div', 'conv-item conv-detalhe');
      det.dataset.convidado = String(foco);
      const meio = el('div', 'meio');
      meio.append(el('strong', undefined, cv.nome), el('span', 'sub bordao', `“${cv.bordao}”`), el('span', 'bom', bonus), el('span', 'ruim', defeito));
      let acao: HTMLElement;
      if (onde >= 0) acao = el('span', 'conv-ja', onde === ch ? 'Já está nesta cadeira' : `Na cadeira ${DA_CADEIRA[onde]}`);
      else {
        const bt = button(`Sentar ${['na frente', 'no meio', 'no canto'][ch]}`, 'btn main', () => { marcado = null; escolhendo = null; a.sentar(ch, foco); });
        bt.disabled = ocupado || tr.trocas < 1;
        acao = bt;
      }
      det.append(peca('conv-retrato', ativos.convidado(foco), 0, 0), meio, acao);
      sel.append(det);
      dir.append(sel);
    }
  }

  return {
    elemento: raiz,
    renderizar,
    /** Fecha a seleção (ex.: depois de sentar). */
    fecharLista() { escolhendo = null; },
    /** Um recado no estúdio até o próximo toque (ex.: Gemaplys e MC V.V juntos). */
    recado(texto: string | null) { recado = texto; refazer(); },
  };
}
