// Tela da Fellas Inc. em DOM puro (sem framework), no padrão do Blackjack: monta uma vez; `renderizar` a cada
// mudança de estado; `atualizarValor` ~10x por segundo (só o número e quais botões estão liberados).
// Texto de usuário sempre por textContent.
import { button, el } from '../shared/hud/hud';
import type { IdleBoardRow, IdleState } from '../shared/types';
import { ativos } from './ativos';
import { catalogo, type Melhoria } from './catalogo';
import { custoMult, liberada, maxCompra, podeComprarGerador, preco, taxaPorUnidade } from './economia';
import { formatarTaxa, formatarValor } from './formatar';
import { ERAS } from './nomes';
import { instante, TEXTO_TIPO, tipo as tipoOportunidade, VALIDADE_S } from './oportunidades';
import { estrategiaPendente, segundosOportunidade, type Fase } from './store';

export type Aba = 'geradores' | 'melhorias' | 'placar';
export type Modelo = {
  fase: Fase; estado: IdleState | null; aba: Aba; placar: IdleBoardRow[] | null; aviso: string | null;
  ocupado: boolean; pendentes: number[]; aoVivo: number | null; caixaAberta: boolean;
};
export type Acoes = {
  abrirCnpj(): void; comprar(tipo: 'gerador' | 'melhoria', id: number, qtd: 0 | 1 | 10): void; escolher(era: number, opcao: number): void;
  pegar(janela: number): void; trocarAba(aba: Aba): void; caixa(aberta: boolean): void; tentarDeNovo(): void;
};
export type Tela = { canvas: HTMLCanvasElement; renderizar(m: Modelo): void; atualizarValor(valor: number): void; fatal(texto: string): void };

const mostrar = (n: HTMLElement, sim: boolean) => (sim ? n.removeAttribute('hidden') : n.setAttribute('hidden', ''));
const NIVEL = ['bronze', 'prata', 'ouro', 'roxo', 'diamante'];

/** "some em 3h12" / "some em 40 min": quanto falta pra oportunidade guardada sumir. */
export function prazo(ms: number) {
  const min = Math.ceil(ms / 60000);
  if (min <= 1) return 'some em menos de 1 min';
  if (min < 60) return `some em ${min} min`;
  return `some em ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

/** X desenhado (não glifo), traço de 2px. */
function iconeFechar() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', 'M5 5l10 10M15 5L5 15');
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '2');
  p.setAttribute('stroke-linecap', 'round');
  svg.append(p);
  return svg;
}

export function criarTela(root: HTMLElement, a: Acoes): Tela {
  const app = el('div', 'app idle');
  const topo = el('header', 'top');
  const voltar = el('a', undefined, '← Voltar');
  voltar.href = '/games';
  const caixinha = button('Oportunidades (0)', 'btn caixinha', () => a.caixa(true));
  topo.append(voltar, el('span', undefined, 'Fellas Inc.'), caixinha);

  const palco = el('div', 'palco');
  const canvas = el('canvas', 'cena');
  const vivo = button('', 'vivo', () => undefined);
  palco.append(canvas, vivo);

  const placa = el('div', 'valor');
  const numero = el('div', 'numero', 'R$ 0');
  const taxaTxt = el('div', 'taxa', '');
  const bonus = el('div', 'bonus', '');
  placa.append(numero, taxaTxt, bonus);

  const abrir = el('div', 'abrir');
  abrir.append(el('p', undefined, '3h06. Bora fundar uma empresa?'), button('Abrir CNPJ', 'btn main', a.abrirCnpj));

  const abas = el('nav', 'abas');
  const botoesAba: Record<Aba, HTMLButtonElement> = {
    geradores: button('Geradores', 'aba', () => a.trocarAba('geradores')),
    melhorias: button('Melhorias', 'aba', () => a.trocarAba('melhorias')),
    placar: button('Placar', 'aba', () => a.trocarAba('placar')),
  };
  abas.append(botoesAba.geradores, botoesAba.melhorias, botoesAba.placar);
  const listaG = el('div', 'lista lista-geradores');
  const listaM = el('div', 'lista lista-melhorias');
  const listaP = el('ol', 'lista lista-placar');
  const painel = el('main', 'painel');
  painel.append(abrir, abas, listaG, listaM, listaP);

  const notice = el('div', 'notice');
  notice.setAttribute('role', 'status');
  const noticeTxt = el('span');
  notice.append(noticeTxt, button('Tentar de novo', '', a.tentarDeNovo));
  const overlay = el('div', 'overlay');
  const overlayTxt = el('p');
  const entrar = el('a', 'btn main', 'Entrar');
  entrar.href = '/';
  const deNovo = button('Tentar de novo', 'btn main', () => location.reload());
  overlay.append(overlayTxt, entrar, deNovo);

  const modalE = el('div', 'modal modal-estrategia');
  const modalC = el('div', 'modal modal-caixa');
  for (const [modal, titulo] of [[modalE, 'idle-titulo-estrategia'], [modalC, 'idle-titulo-caixa']] as const) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', titulo);
  }
  const titulo = (id: string, texto: string) => {
    const h = el('h2', undefined, texto);
    h.id = id;
    return h;
  };

  app.append(topo, palco, placa, painel, notice, overlay, modalE, modalC);
  root.append(app);

  // botões que dependem do valor (atualizados em atualizarValor)
  let precos: { botao: HTMLButtonElement; preco: number; maximo?: { custo: number; n: number; cm: number } }[] = [];
  // "some em ..." das oportunidades guardadas (atualizado em atualizarValor)
  let prazos: { texto: HTMLElement; fim: number }[] = [];
  // aba Melhorias: à venda ou as já compradas (só apresentação; refaz com o último modelo)
  let verCompradas = false;
  let ultimo: Modelo | null = null;

  function linhaGerador(s: IdleState, gid: number) {
    const g = catalogo.geradores[gid - 1];
    const n = s.generators[gid - 1];
    const linha = el('div', 'gerador');
    const sprite = el('div', 'sprite');
    sprite.style.backgroundImage = `url(${ativos.gerador(gid)})`;
    const meio = el('div', 'meio');
    meio.append(el('strong', undefined, g.nome), el('span', 'sub', `×${n} · ${formatarTaxa(taxaPorUnidade(catalogo, s, gid))} cada`));
    const cm = custoMult(catalogo, s);
    const botoes = el('div', 'compra');
    const um = button(formatarValor(preco(g.custo, n, 1, cm) * (s.half_price ? 0.5 : 1)), 'btn', () => a.comprar('gerador', gid, 1));
    um.dataset.qtd = '1';
    const dez = button('10', 'btn', () => a.comprar('gerador', gid, 10));
    dez.dataset.qtd = '10';
    const max = button('Máx', 'btn', () => a.comprar('gerador', gid, 0));
    max.dataset.qtd = '0';
    precos.push(
      { botao: um, preco: preco(g.custo, n, 1, cm) * (s.half_price ? 0.5 : 1) },
      { botao: dez, preco: preco(g.custo, n, 10, cm) },
      { botao: max, preco: preco(g.custo, n, 1, cm), maximo: { custo: g.custo, n, cm } },
    );
    botoes.append(um, dez, max);
    linha.append(sprite, meio, botoes);
    return linha;
  }

  function linhaTrancada(gid: number) {
    const linha = el('div', 'gerador trancado');
    linha.append(el('div', 'sprite'), el('div', 'meio', `Compra 1 "${catalogo.geradores[gid - 2].nome}" pra liberar`));
    return linha;
  }

  function iconeMelhoria(m: Melhoria) {
    const box = el('div', 'icone');
    if (m.tipo === 'gerador') {
      box.classList.add(NIVEL[m.nivel - 1]);
      box.style.backgroundImage = `url(${ativos.gerador(m.gerador)})`;
    } else if (m.tipo === 'geral') {
      const url = ativos.geral(m.id);
      if (url) box.style.backgroundImage = `url(${url})`;
      box.classList.add('geral');
    } else {
      box.classList.add('sinergia');
      for (const id of [m.fonte, m.alvo]) {
        const mini = el('span', 'mini');
        mini.style.backgroundImage = `url(${ativos.gerador(id)})`;
        box.append(mini);
      }
    }
    return box;
  }

  function renderizar(m: Modelo) {
    ultimo = m;
    const s = m.estado;
    const jogando = m.fase === 'jogando' || m.fase === 'abrindo';
    precos = [];
    prazos = [];
    mostrar(abrir, m.fase === 'antes');
    mostrar(abas, jogando);
    mostrar(placa, jogando);
    for (const k of Object.keys(botoesAba) as Aba[]) botoesAba[k].classList.toggle('ativa', m.aba === k);
    mostrar(listaG, jogando && m.aba === 'geradores');
    mostrar(listaM, jogando && m.aba === 'melhorias');
    mostrar(listaP, jogando && m.aba === 'placar');
    caixinha.textContent = `Oportunidades (${m.pendentes.length})`;
    mostrar(caixinha, jogando);

    listaG.replaceChildren();
    listaM.replaceChildren();
    if (s && jogando) {
      taxaTxt.textContent = formatarTaxa(s.rate);
      const agoraBoost = s.boost_until && Date.parse(s.boost_until) > Date.parse(s.server_now);
      bonus.textContent = agoraBoost ? 'Produção ×5 por alguns segundos' : s.half_price ? 'Próxima compra pela metade' : '';
      for (let gid = 1; gid <= 30; gid++) {
        if (podeComprarGerador(s, gid)) listaG.append(linhaGerador(s, gid));
        else {
          listaG.append(linhaTrancada(gid));
          break;
        }
      }
      const cm = custoMult(catalogo, s);
      const disponiveis = catalogo.melhorias
        .filter((x) => !s.upgrades.includes(x.id) && liberada(catalogo, x, s))
        .sort((x, y) => x.preco - y.preco);
      const compradas = s.upgrades
        .map((id) => catalogo.melhorias.find((x) => x.id === id))
        .filter((x): x is Melhoria => !!x)
        .reverse();
      const seg = el('div', 'seg');
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', 'Melhorias');
      for (const [compradasAba, texto] of [[false, `À venda (${disponiveis.length})`], [true, `Compradas (${compradas.length})`]] as const) {
        const b = button(texto, verCompradas === compradasAba ? 'ativo' : '', () => {
          verCompradas = compradasAba;
          if (ultimo) renderizar(ultimo);
        });
        b.setAttribute('aria-pressed', String(verCompradas === compradasAba));
        seg.append(b);
      }
      listaM.append(seg);
      if (verCompradas) {
        if (!compradas.length) listaM.append(el('p', 'vazio', 'Nenhuma melhoria comprada ainda.'));
        for (const x of compradas) {
          const item = el('div', 'melhoria comprada');
          const meio = el('div', 'meio');
          meio.append(el('strong', undefined, x.nome), el('span', 'sub', x.frase));
          item.append(iconeMelhoria(x), meio);
          listaM.append(item);
        }
      }
      if (!verCompradas && !disponiveis.length) listaM.append(el('p', 'vazio', 'Nenhuma melhoria liberada agora. Compra mais geradores.'));
      for (const x of verCompradas ? [] : disponiveis) {
        const item = el('div', 'melhoria');
        const meio = el('div', 'meio');
        meio.append(el('strong', undefined, x.nome), el('span', 'sub', x.frase));
        const p = x.preco * cm * (s.half_price ? 0.5 : 1);
        const comprar = button(formatarValor(p), 'btn', () => a.comprar('melhoria', x.id, 1));
        precos.push({ botao: comprar, preco: p });
        item.append(iconeMelhoria(x), meio, comprar);
        listaM.append(item);
      }
    }

    listaP.replaceChildren();
    if (!m.placar) listaP.append(el('li', 'vazio', 'Carregando…'));
    else {
      if (!m.placar.length) listaP.append(el('li', 'vazio', 'Ninguém abriu a empresa ainda.'));
      m.placar.forEach((r, i) => {
        const li = el('li', r.userId === s?.user_id ? 'eu' : undefined);
        const est = r.strategies
          .map((o, k) => catalogo.estrategias.find((e) => e.era === k + 2 && e.opcao === o)?.nome)
          .filter(Boolean)
          .join(' · ');
        li.append(el('span', 'pos', `${i + 1}º`), el('span', 'nome', r.name), el('span', 'sub', `${ERAS[r.era - 1]}${est ? ` · ${est}` : ''}`), el('span', 'v', formatarTaxa(r.rate)));
        listaP.append(li);
      });
    }

    // oportunidade passando na cena
    mostrar(vivo, !!s && m.aoVivo !== null && s.opp_left > 0);
    if (s && m.aoVivo !== null) {
      const w = m.aoVivo;
      vivo.style.backgroundImage = `url(${ativos.oportunidade(tipoOportunidade(s.user_id, w))})`;
      vivo.style.animationDuration = `${segundosOportunidade(s)}s`;
      vivo.setAttribute('aria-label', `Pegar oportunidade: ${TEXTO_TIPO[tipoOportunidade(s.user_id, w)]}`);
      vivo.onclick = () => a.pegar(w);
    }

    // estratégia
    const era = s ? estrategiaPendente(s) : null;
    modalE.replaceChildren();
    mostrar(modalE, jogando && era !== null);
    if (era !== null) {
      const folha = el('div', 'folha');
      const topo = el('div', 'folha-topo');
      topo.append(titulo('idle-titulo-estrategia', `Era ${era}: ${ERAS[era - 1]}`));
      const lista = el('ul', 'escolhas');
      for (const e of catalogo.estrategias.filter((x) => x.era === era)) {
        const li = el('li', e.ativa ? 'escolha' : 'escolha off');
        const texto = el('div', 'escolha-texto');
        texto.append(el('strong', undefined, e.nome), el('span', 'sub', e.frase));
        li.append(texto);
        if (e.ativa) {
          const b = button('Escolher', 'btn main compacto', () => a.escolher(era, e.opcao));
          b.disabled = m.ocupado;
          li.append(b);
        } else {
          li.append(el('span', 'em-breve', e.requer === 'contratos' ? 'Chega com Contratar' : 'Chega com o Mapa do rolê'));
        }
        lista.append(li);
      }
      folha.append(topo, el('p', 'sub', 'Escolhe a estratégia da empresa. Não tem volta.'), lista);
      modalE.append(folha);
    }

    // caixinha
    modalC.replaceChildren();
    mostrar(modalC, m.caixaAberta && jogando);
    if (s && m.caixaAberta) {
      const folha = el('div', 'folha');
      const topo = el('div', 'folha-topo');
      const fechar = button('', 'fechar', () => a.caixa(false));
      fechar.setAttribute('aria-label', 'Fechar');
      fechar.append(iconeFechar());
      topo.append(titulo('idle-titulo-caixa', 'Oportunidades guardadas'), fechar);
      folha.append(topo, el('p', 'sub', s.opp_left > 0 ? `Hoje ainda dá pra pegar ${s.opp_left}.` : 'Já pegou todas de hoje. Amanhã tem mais.'));
      if (!m.pendentes.length) folha.append(el('p', 'vazio', 'Nada guardado agora. Volta mais tarde.'));
      const lista = el('ul', 'escolhas');
      for (const w of m.pendentes) {
        const k = tipoOportunidade(s.user_id, w);
        const li = el('li', 'escolha');
        const boneco = el('div', 'boneco');
        boneco.style.backgroundImage = `url(${ativos.oportunidade(k)})`;
        const texto = el('div', 'escolha-texto');
        const quando = el('span', 'sub prazo', '');
        texto.append(el('strong', undefined, TEXTO_TIPO[k]), quando);
        prazos.push({ texto: quando, fim: instante(s.user_id, w) + VALIDADE_S * 1000 });
        const b = button('Pegar', 'btn main compacto', () => a.pegar(w));
        b.disabled = m.ocupado || s.opp_left <= 0;
        li.append(boneco, texto, b);
        lista.append(li);
      }
      if (m.pendentes.length) folha.append(lista);
      modalC.append(folha);
      atualizarPrazos();
    }

    noticeTxt.textContent = m.aviso ?? '';
    mostrar(notice, !!m.aviso);
    overlayTxt.textContent = 'Entra no fellas pra jogar';
    mostrar(entrar, true);
    mostrar(deNovo, false);
    mostrar(overlay, m.fase === 'sem_sessao');
  }

  function atualizarPrazos() {
    const agora = Date.now();
    for (const p of prazos) p.texto.textContent = prazo(p.fim - agora);
  }

  function atualizarValor(valor: number) {
    numero.textContent = formatarValor(valor);
    atualizarPrazos();
    for (const p of precos) {
      p.botao.disabled = p.preco > valor;
      if (p.maximo) {
        const k = maxCompra(p.maximo.custo, p.maximo.n, valor, p.maximo.cm);
        p.botao.textContent = k > 1 ? `Máx (${k})` : 'Máx';
      }
    }
  }

  function fatal(texto: string) {
    overlayTxt.textContent = texto;
    mostrar(entrar, false);
    mostrar(deNovo, true);
    mostrar(overlay, true);
    mostrar(painel, false);
  }

  return { canvas, renderizar, atualizarValor, fatal };
}
