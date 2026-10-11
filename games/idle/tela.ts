// Tela da Fellas Inc. em DOM puro (sem framework), no padrão do Blackjack: monta uma vez; `renderizar` a cada
// mudança de estado; `atualizarValor` ~10x por segundo (só o número e quais botões estão liberados).
// Texto de usuário sempre por textContent.
import { button, el } from '../shared/hud/hud';
import type { IdleBoardRow, IdleState, IdleVisual } from '../shared/types';
import { ativos } from './ativos';
import { catalogo, type Melhoria } from './catalogo';
import { falta, ganhouEm, grade, pontos, RAMOS_ARVORE, situacao, textoVenda, TOTAL_CONQUISTAS, type Celula } from './legado';
import { custoMult, liberada, maxCompra, multContratos, podeComprarGerador, preco, taxaPorUnidade } from './economia';
import { formatarTaxa, formatarValor } from './formatar';
import type { Pose } from './montagem';
import type { Desenhar } from './navegador';
import { ERAS, VISUAL_NOMES } from './nomes';
import { sai, TEXTO_TIPO, tipo as tipoOportunidade } from './oportunidades';
import { CORES, CORES_CABELO, PADRAO, PELES, type Campo, type Tons } from './personagem';
import { caixa, estrategiaPendente, segundosOportunidade, type Fase } from './store';

export type Aba = 'loja' | 'gente' | 'placar' | 'legado';
export type AcaoEditor = 'abrir' | 'fechar' | 'sortear' | 'salvar';
export type Modelo = {
  fase: Fase; estado: IdleState | null; aba: Aba; placar: IdleBoardRow[] | null; aviso: string | null;
  ocupado: boolean; pendentes: number[]; aoVivo: number | null; caixaAberta: boolean;
  /** O último pedido do placar falhou (e ainda não há placar pra mostrar). */
  placarFalhou: boolean;
  /** Rascunho do editor de personagem (null = fechado). */
  editor: IdleVisual | null;
  /** Folha "Vender a startup?" aberta. */
  vendaAberta: boolean;
  /** O aviso de conquista na cena agora ("Conquista: 6-7"); null = nenhum. */
  conquistaAviso: string | null;
};
export type Acoes = {
  abrirCnpj(): void; comprar(tipo: 'gerador' | 'melhoria', id: number, qtd: 0 | 1 | 10): void; escolher(era: number, opcao: number): void;
  pegar(janela: number): void; trocarAba(aba: Aba): void; caixa(aberta: boolean): void; tentarDeNovo(): void;
  contratar(userId: string): void; editor(acao: AcaoEditor): void; mudarVisual(campo: Campo, valor: number): void;
  vender(acao: 'abrir' | 'fechar' | 'confirmar'): void; comprarNo(id: number): void;
};
export type Tela = { canvas: HTMLCanvasElement; renderizar(m: Modelo): void; atualizarValor(valor: number): void; fatal(texto: string): void };

const mostrar = (n: HTMLElement, sim: boolean) => (sim ? n.removeAttribute('hidden') : n.setAttribute('hidden', ''));
const ERRO_GALERA = 'Não deu pra carregar a galera. Tenta de novo.';
const NIVEL = ['bronze', 'prata', 'ouro', 'roxo', 'diamante'];

/** Oportunidade do tipo "próxima compra pela metade" (2) com uma já guardada: pegar não daria nada. */
export const meiaPrecoRepetida = (tipo: 0 | 1 | 2, s: IdleState) => tipo === 2 && s.half_price;

/** "some em 3h12" / "some em 40 min": quanto falta pra oportunidade guardada sumir. */
export function prazo(ms: number) {
  const min = Math.ceil(ms / 60000);
  if (min <= 1) return 'some em menos de 1 min';
  if (min < 60) return `some em ${min} min`;
  return `some em ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

/** "+12%" / "+2,5%": o bônus dos contratos em pt-BR, com uma casa no máximo. */
export const porcento = (mult: number) => `+${(Math.round((mult - 1) * 1000) / 10).toLocaleString('pt-BR')}%`;

/** Em quantas empresas alguém trabalha agora (carta de contratar). */
export function empresas(n: number) {
  if (n === 0) return 'ninguém contratou ainda';
  return n === 1 ? 'trabalha em 1 empresa' : `trabalha em ${n} empresas`;
}

/** Quanto falta pro contrato vencer: "por mais 6 dias", "por mais 5 h", "por menos de 1 h". */
export function restam(ms: number) {
  const h = Math.floor(ms / 3600_000);
  if (h < 1) return 'por menos de 1 h';
  if (h < 24) return `por mais ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'por mais 1 dia' : `por mais ${d} dias`;
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

export function criarTela(root: HTMLElement, a: Acoes, desenhar: Desenhar = () => undefined): Tela {
  const app = el('div', 'app idle');
  const topo = el('header', 'top');
  const voltar = el('a', undefined, '← Voltar');
  voltar.href = '/games';
  const caixinha = button('Oportunidades (0)', 'btn caixinha', () => a.caixa(true));
  topo.append(voltar, el('span', undefined, 'Fellas Inc.'), caixinha);

  const palco = el('div', 'palco');
  const canvas = el('canvas', 'cena');
  const vivo = button('', 'vivo', () => undefined);
  const avisoConquista = el('div', 'conquista-aviso');
  avisoConquista.setAttribute('role', 'status');
  palco.append(canvas, vivo, avisoConquista);

  const placa = el('div', 'valor');
  const numero = el('div', 'numero', 'F$ 0');
  const taxaTxt = el('div', 'taxa', '');
  const bonus = el('div', 'bonus', '');
  placa.append(numero, taxaTxt, bonus);

  const abrir = el('div', 'abrir');
  abrir.append(
    el('p', undefined, '3h06. Bora fundar uma empresa?'),
    button('Abrir CNPJ', 'btn main', a.abrirCnpj),
    button('Mudar visual', 'btn', () => a.editor('abrir')),
  );

  const abas = el('nav', 'abas');
  const botoesAba: Record<Aba, HTMLButtonElement> = {
    loja: button('Loja', 'aba', () => a.trocarAba('loja')),
    gente: button('Gente', 'aba', () => a.trocarAba('gente')),
    placar: button('Placar', 'aba', () => a.trocarAba('placar')),
    legado: button('Legado', 'aba', () => a.trocarAba('legado')),
  };
  abas.append(botoesAba.loja, botoesAba.gente, botoesAba.placar, botoesAba.legado);
  // Loja: Geradores | Melhorias (só apresentação, como o À venda | Compradas)
  const segLoja = el('div', 'seg seg-loja');
  segLoja.setAttribute('role', 'group');
  segLoja.setAttribute('aria-label', 'Loja');
  const verGeradores = button('Geradores', '', () => {
    lojaVer = 'geradores';
    if (ultimo) renderizar(ultimo);
  });
  const verMelhorias = button('Melhorias', '', () => {
    lojaVer = 'melhorias';
    if (ultimo) renderizar(ultimo);
  });
  segLoja.append(verGeradores, verMelhorias);
  const listaG = el('div', 'lista lista-geradores');
  const listaM = el('div', 'lista lista-melhorias');
  const listaC = el('div', 'lista lista-contratar');
  const listaP = el('ol', 'lista lista-placar');
  const listaL = el('div', 'lista lista-legado');
  const painel = el('main', 'painel');
  painel.append(abrir, abas, segLoja, listaG, listaM, listaC, listaP, listaL);

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
  const modalV = el('div', 'modal modal-visual');
  const modalP = el('div', 'modal modal-venda');
  for (const [modal, titulo] of [
    [modalE, 'idle-titulo-estrategia'], [modalC, 'idle-titulo-caixa'], [modalV, 'idle-titulo-visual'], [modalP, 'idle-titulo-venda'],
  ] as const) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', titulo);
  }
  const titulo = (id: string, texto: string) => {
    const h = el('h2', undefined, texto);
    h.id = id;
    return h;
  };

  app.append(topo, palco, placa, painel, notice, overlay, modalE, modalC, modalV, modalP);
  root.append(app);

  // botões que dependem do valor (atualizados em atualizarValor)
  let precos: { botao: HTMLButtonElement; preco: number; maximo?: { custo: number; n: number; cm: number } }[] = [];
  // "some em ..." das oportunidades guardadas (atualizado em atualizarValor)
  let prazos: { texto: HTMLElement; fim: number }[] = [];
  // aba Melhorias: à venda ou as já compradas (só apresentação; refaz com o último modelo)
  let verCompradas = false;
  // aba Loja: Geradores ou Melhorias (só apresentação)
  let lojaVer: 'geradores' | 'melhorias' = 'geradores';
  // aba Legado: a conquista tocada (mostra a frase e a data); só apresentação
  let conquistaAberta: number | null = null;
  let ultimo: Modelo | null = null;

  /** Personagem num canvas pequeno (o CSS amplia). rotulo null = decorativo (o nome já está do lado). */
  function boneco(v: IdleVisual | null, rotulo: string | null, opcoes?: { pose?: Pose; cadeira?: boolean }) {
    const c = el('canvas', 'mini-boneco');
    if (rotulo) {
      c.setAttribute('role', 'img');
      c.setAttribute('aria-label', rotulo);
    } else c.setAttribute('aria-hidden', 'true');
    desenhar(c, v ?? PADRAO, opcoes);
    return c;
  }

  /** Uma linha do editor: rótulo + botões (texto, ou amostras de cor com `tons`). */
  function opcoes(rotulo: string, grupoNome: string, campo: Campo, v: IdleVisual, tons?: readonly Tons[]) {
    const linha = el('div', 'opcoes');
    linha.setAttribute('role', 'group');
    linha.setAttribute('aria-label', grupoNome);
    const botoes = el('div', 'opcoes-botoes');
    VISUAL_NOMES[campo].forEach((nome, i) => {
      const b = button(tons ? '' : nome, tons ? 'cor' : 'chip', () => a.mudarVisual(campo, i));
      if (tons) {
        b.style.backgroundColor = tons[i][1];
        b.setAttribute('aria-label', nome);
      }
      b.setAttribute('aria-pressed', String(v[campo] === i));
      botoes.append(b);
    });
    linha.append(el('span', 'opcoes-rotulo', rotulo), botoes);
    return linha;
  }

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

  /** Ícone 16x16 ampliado; sem a arte, só a moldura. */
  function iconeLegado(url: string | null) {
    const box = el('div', 'icone-legado');
    if (url) box.style.backgroundImage = `url(${url})`;
    else box.classList.add('sem-arte');
    return box;
  }

  /** Aba Legado: o card de prestígio, a árvore (raiz e 5 ramos) e a grade de conquistas (tocar mostra a frase e a data). */
  function legado(s: IdleState, ocupado: boolean) {
    const card = el('div', 'prestigio');
    const meio = el('div', 'meio');
    const vezes = s.vendas === 1 ? 'vendeu 1 vez' : `vendeu ${s.vendas} vezes`;
    meio.append(
      el('strong', undefined, `★ ${pontos(s.pontos)} pra gastar`),
      el('span', 'sub', `${s.pontos_vida} ganhos na vida · recorde ${formatarTaxa(s.recorde)}${s.vendas ? ` · ${vezes}` : ''}`),
    );
    const vender = button(
      s.pontos_venda >= 1 ? `Vender a startup · +${pontos(s.pontos_venda)}` : 'Ainda não compensa',
      'btn main', () => a.vender('abrir'),
    );
    vender.disabled = s.pontos_venda < 1 || ocupado;
    card.append(meio, vender);

    const arvore = el('div', 'arvore');
    for (const r of RAMOS_ARVORE) {
      const ramo = el('section', r.ramo === 0 ? 'ramo raiz' : 'ramo');
      ramo.append(el('h3', 'ramo-nome', r.nome));
      for (const n of r.nos) {
        const sit = situacao(n, s.bonus.arvore);
        const no = el('div', `no ${sit}`);
        const texto = el('div', 'meio');
        texto.append(el('strong', undefined, n.nome), el('span', 'sub', n.efeito));
        no.append(iconeLegado(ativos.no(n.id)), texto);
        if (sit === 'comprado') no.append(el('span', 'no-status', 'Comprado'));
        else if (sit === 'trancado') no.append(el('span', 'no-status', falta(n)));
        else {
          const b = button(`Comprar · ${n.custo} ★`, 'btn compacto', () => a.comprarNo(n.id));
          b.disabled = ocupado || s.pontos < n.custo;
          no.append(b);
        }
        ramo.append(no);
      }
      arvore.append(ramo);
    }

    const celulas = grade(s);
    const topoQ = el('h3', 'legado-titulo', `Conquistas ${s.conquistas.length}/${TOTAL_CONQUISTAS} · +${s.bonus.conquistas}% de produção`);
    const grid = el('div', 'grade-conquistas');
    for (const c of celulas) {
      const b = button('', c.ganhou ? 'conquista ganha' : 'conquista', () => {
        conquistaAberta = conquistaAberta === c.conquista.id ? null : c.conquista.id;
        if (ultimo) renderizar(ultimo);
      });
      b.setAttribute('aria-pressed', String(conquistaAberta === c.conquista.id));
      b.append(iconeLegado(ativos.conquista(c.conquista.id)), el('span', 'conquista-nome', c.nome));
      grid.append(b);
    }
    listaL.append(card, el('h3', 'legado-titulo', 'Árvore de habilidades'), arvore, topoQ);
    const aberta = celulas.find((c: Celula) => c.conquista.id === conquistaAberta);
    if (aberta) {
      const det = el('div', 'conquista-detalhe');
      det.append(el('strong', undefined, aberta.nome), el('span', 'sub', aberta.texto));
      if (aberta.em) det.append(el('span', 'sub', ganhouEm(aberta.em)));
      listaL.append(det);
    }
    listaL.append(grid);
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
    const naLoja = jogando && m.aba === 'loja';
    mostrar(segLoja, naLoja);
    for (const [b, v] of [[verGeradores, 'geradores'], [verMelhorias, 'melhorias']] as const) {
      b.classList.toggle('ativo', lojaVer === v);
      b.setAttribute('aria-pressed', String(lojaVer === v));
    }
    mostrar(listaG, naLoja && lojaVer === 'geradores');
    mostrar(listaM, naLoja && lojaVer === 'melhorias');
    mostrar(listaC, jogando && m.aba === 'gente');
    mostrar(listaP, jogando && m.aba === 'placar');
    // Legado: na aba, ou embaixo do "Abrir CNPJ" de quem já vendeu (dá pra gastar os pontos antes de reabrir)
    const verLegado = !!s && ((jogando && m.aba === 'legado') || (m.fase === 'antes' && s.pontos_vida > 0));
    mostrar(listaL, verLegado);
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
      verMelhorias.textContent = disponiveis.length ? `Melhorias (${disponiveis.length})` : 'Melhorias';
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

    // contratar: você no topo (bônus, quem te contratou), depois uma carta por fella que abriu a empresa
    listaC.replaceChildren();
    if (s && jogando && m.aba === 'gente') {
      const agora = Date.parse(s.server_now);
      const nome = (uid: string) => m.placar?.find((r) => r.userId === uid)?.name ?? 'Alguém';
      const topoC = el('div', 'contratos-topo');
      const texto = el('div', 'meio');
      texto.append(
        el('strong', undefined, `Contratos: ${porcento(multContratos(catalogo, s))} de produção`),
        el('span', 'sub', s.chefes.length
          ? `Você trabalha pra ${s.chefes.map((c) => `${nome(c.user_id)} (${c.cargo}, ${restam(Date.parse(c.ate) - agora)})`).join(', ')}.`
          : 'Ninguém te contratou: você ganha o piso de freela.'),
      );
      topoC.append(boneco(s.avatar, 'Seu personagem'), texto, button('Mudar visual', 'btn', () => a.editor('abrir')));
      listaC.append(topoC);
      if (!m.placar) listaC.append(el('p', 'vazio', m.placarFalhou ? ERRO_GALERA : 'Carregando…'));
      else {
        const outros = m.placar.filter((r) => r.userId !== s.user_id);
        if (!outros.length) listaC.append(el('p', 'vazio', 'Ninguém mais abriu a empresa ainda. Chama a galera.'));
        for (const r of outros) {
          const carta = el('div', 'carta');
          const meio = el('div', 'meio');
          meio.append(el('strong', undefined, r.name), el('span', 'sub', `${ERAS[r.era - 1]} · ${empresas(r.hiredCount)}`));
          carta.append(boneco(r.avatar, null), meio);
          // "já trabalha pra você" vem do estado (sempre fresco), não só do placar (recarrega a cada 60 s)
          const meu = s.equipe.find((e) => e.user_id === r.userId);
          if (meu) {
            carta.append(el('span', 'contratado', `Trabalha pra você como ${meu.cargo} ${restam(Date.parse(meu.ate) - agora)}`));
          } else {
            const b = button(`Contratar · ${formatarValor(s.hire_price)}`, 'btn', () => a.contratar(r.userId));
            precos.push({ botao: b, preco: s.hire_price });
            carta.append(b);
          }
          listaC.append(carta);
        }
      }
    }

    listaL.replaceChildren();
    if (s && verLegado) legado(s, m.ocupado);

    listaP.replaceChildren();
    if (!m.placar) listaP.append(el('li', 'vazio', m.placarFalhou ? ERRO_GALERA : 'Carregando…'));
    else {
      if (!m.placar.length) listaP.append(el('li', 'vazio', 'Ninguém abriu a empresa ainda.'));
      m.placar.forEach((r, i) => {
        const li = el('li', r.userId === s?.user_id ? 'eu' : undefined);
        // a era é a cena em que a pessoa está (cena 1 = era 1, cena 2 = era 2...)
        li.append(
          el('span', 'pos', `${i + 1}º`), boneco(r.avatar, null), el('span', 'nome', r.name),
          el('span', 'sub', `Era ${r.era} · ${ERAS[r.era - 1]}`), el('span', 'v', formatarTaxa(r.rate)),
        );
        if (r.pontos > 0) li.append(el('span', 'pontos', `★ ${r.pontos}`));
        if (r.mostHired) li.append(el('span', 'disputado', 'Mais disputado da semana'));
        listaP.append(li);
      });
    }

    // oportunidade passando na cena
    // a meia-preço que passa na cena some se você já tem uma guardada (não acumula)
    mostrar(vivo, !!s && m.aoVivo !== null && s.opp_left > 0 && !meiaPrecoRepetida(tipoOportunidade(s.user_id, m.aoVivo), s));
    if (s && m.aoVivo !== null) {
      const w = m.aoVivo;
      vivo.style.backgroundImage = `url(${ativos.oportunidade(tipoOportunidade(s.user_id, w))})`;
      vivo.style.animationDuration = `${segundosOportunidade(s, s.bonus.arvore)}s`;
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
        const bonequinho = el('div', 'boneco');
        bonequinho.style.backgroundImage = `url(${ativos.oportunidade(k)})`;
        const texto = el('div', 'escolha-texto');
        const quando = el('span', 'sub prazo', '');
        texto.append(el('strong', undefined, TEXTO_TIPO[k]), quando);
        prazos.push({ texto: quando, fim: sai(s.user_id, w, caixa(s).tamanho) });
        // meia-preço não acumula: pegar outra antes de usar a guardada só gastaria uma pega do dia
        const repetida = meiaPrecoRepetida(k, s);
        if (repetida) texto.append(el('span', 'sub', 'Usa a que você já tem primeiro'));
        const b = button('Pegar', 'btn main compacto', () => a.pegar(w));
        b.disabled = m.ocupado || s.opp_left <= 0 || repetida;
        li.append(bonequinho, texto, b);
        lista.append(li);
      }
      if (m.pendentes.length) folha.append(lista);
      modalC.append(folha);
      atualizarPrazos();
    }

    // editor de personagem
    modalV.replaceChildren();
    mostrar(modalV, m.editor !== null && (m.fase === 'antes' || jogando));
    if (m.editor) {
      const v = m.editor;
      const folha = el('div', 'folha');
      const topoV = el('div', 'folha-topo');
      const fechar = button('', 'fechar', () => a.editor('fechar'));
      fechar.setAttribute('aria-label', 'Fechar');
      fechar.append(iconeFechar());
      topoV.append(titulo('idle-titulo-visual', 'Seu visual'), fechar);
      const previa = el('div', 'previa');
      previa.append(boneco(v, 'Você de frente', { pose: 5 }), boneco(v, 'Você na cadeira', { pose: 1, cadeira: true }));
      folha.append(
        topoV,
        el('p', 'sub', 'É assim que você aparece nas suas cenas, no placar e na empresa de quem te contratar.'),
        previa,
        opcoes('Pele', 'Pele', 'pele', v, PELES),
        opcoes('Cabelo', 'Cabelo', 'cabelo', v),
        opcoes('Cor', 'Cor do cabelo', 'cor_cabelo', v, CORES_CABELO),
        opcoes('Roupa', 'Roupa', 'roupa', v),
        opcoes('Cor', 'Cor da roupa', 'cor_roupa', v, CORES),
        opcoes('Na cabeça', 'Na cabeça', 'acessorio', v),
      );
      if (v.acessorio > 0) folha.append(opcoes('Cor', 'Cor do que vai na cabeça', 'cor_acessorio', v, CORES));
      const fim = el('div', 'editor-fim');
      const bora = button('Bora', 'btn main', () => a.editor('salvar'));
      bora.disabled = m.ocupado;
      fim.append(button('Sortear', 'btn', () => a.editor('sortear')), bora);
      folha.append(fim);
      modalV.append(folha);
    }

    // vender a startup: confirmação (só com pelo menos 1 ponto a ganhar)
    modalP.replaceChildren();
    const ganho = s && m.vendaAberta && jogando ? s.pontos_venda : 0;
    mostrar(modalP, ganho >= 1);
    if (ganho >= 1) {
      const folha = el('div', 'folha');
      const topoP = el('div', 'folha-topo');
      const fechar = button('', 'fechar', () => a.vender('fechar'));
      fechar.setAttribute('aria-label', 'Fechar');
      fechar.append(iconeFechar());
      topoP.append(titulo('idle-titulo-venda', 'Vender a startup?'), fechar);
      const fim = el('div', 'editor-fim');
      const sim = button('Vender', 'btn main', () => a.vender('confirmar'));
      sim.disabled = m.ocupado;
      fim.append(button('Deixa quieto', 'btn', () => a.vender('fechar')), sim);
      folha.append(topoP, el('p', 'sub', textoVenda(ganho)), fim);
      modalP.append(folha);
    }

    avisoConquista.textContent = m.conquistaAviso ?? '';
    mostrar(avisoConquista, m.conquistaAviso !== null);

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
