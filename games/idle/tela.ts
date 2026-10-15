// Tela da Fellas Inc. em DOM puro (sem framework), no padrão do Blackjack: monta uma vez; `renderizar` a cada
// mudança de estado; `atualizarValor` ~10x por segundo (só o número e quais botões estão liberados).
// Texto de usuário sempre por textContent.
import { button, el } from '../shared/hud/hud';
import type { BolsaEstado, HortaEstado, IdleBoardRow, IdleState, IdleVisual, LadoBolsa, LugarEstado, MapaEstado, MelhoriaBolsa } from '../shared/types';
import { ativos } from './ativos';
import { deEmpresa, empresaDoGerador } from './bolsa';
import { criarBolsaTela } from './bolsaTela';
import { criarHortaTela } from './hortaTela';
import { criarConvidadosTela } from './convidadosTela';
import { portaBolsa, portaConvidados, portaHorta, portaMapa, type ResumoPorta } from './portas';
import { criarMapaTela, nomeLugar } from './mapaTela';
import { criarLugarTela } from './lugarTela';
import type { Dicas } from './mecanicas';
import { aplicarTema } from './temasLugar';
import { CONVIDADOS, custosConv, destrancada, efeitosTexto, multGerador, peso, SEM_CADEIRAS, TERRY, VINI, VORCARO } from './convidados';
import { catalogo, type Melhoria } from './catalogo';
import { criarArvoreTela, miniArvore } from './arvoreTela';
import { dicaConquista, ganhouEm, grade, pontos, situacaoTela, textoVenda, TOTAL_CONQUISTAS, type AvisoConquista, type Celula } from './legado';
import { custoMult, efeitosDe, liberada, maxCompra, multContratos, podeComprarGerador, preco, taxaPorUnidade } from './economia';
import { formatarTaxa, formatarValor } from './formatar';
import type { Pose } from './montagem';
import type { Desenhar } from './navegador';
import type { IdEfeito } from './audio';
import { iconeEngrenagem, iconeFechar } from './icones';
import { criarDouradoTela } from './douradoTela';
import { dicaContratos, dicaGerador, dicaMelhoria, dicaOportunidade, dicaProducao } from './dica';
import { criarDicas } from './dicaTela';
import { ganhoInvestidor, promoAtiva, selosBonus } from './dourados';
import { escalaPc } from './escala';
import type { ChaveSom } from './preferencias';
import { dataNovidade, NOVIDADES } from './novidades';
import { ERAS, VISUAL_NOMES } from './nomes';
import { sai, TEXTO_TIPO, tipo as tipoOportunidade } from './oportunidades';
import { CORES, CORES_CABELO, PADRAO, PELES, type Campo, type Tons } from './personagem';
import { caixa, estrategiaPendente, rotuloEra, segundosOportunidade, type Fase } from './store';

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
  conquistaAviso: AvisoConquista | null;
  /** Estado da Bolsa (null = ainda não buscou). */
  bolsa: BolsaEstado | null;
  /** Gaveta Bolsa aberta (PC: no corpo da bancada; celular: tela cheia). */
  bolsaAberta: boolean;
  /** Folha de Configurações: fechada, o menu ou as patch notes. */
  config: TelaConfig;
  /** Chaves de efeitos e avisos (guardadas no aparelho). */
  chaves: Record<ChaveSom, boolean>;
  /** Volume da música, de 0 (desligada) a 1. */
  volumeMusica: number;
  /** Horta (minigame 2): gaveta aberta e o último estado buscado (null = ainda não buscou). */
  hortaAberta: boolean;
  horta: HortaEstado | null;
  /** Convidados (minigame 3): gaveta aberta (o estado vem no IdleState). */
  convidadosAberto: boolean;
  /** Mapa do rolê: tela cheia aberta e o último mapa buscado (null = ainda não buscou). */
  mapaAberto: boolean;
  mapa: MapaEstado | null;
  /** Lugar aberto dentro do mapa (null = o mapa) e o último estado dele. */
  lugarAberto: number | null;
  lugar: LugarEstado | null;
  /** Nomes (user_id -> nome) de quem aparece no pódio e na semana do lugar aberto. */
  nomesLugar: Map<string, string>;
  /** Agora no relógio do servidor (ms): a Promoção valendo muda os preços. Sem = a hora do estado. */
  agora?: number;
  /** Tem patch note que a pessoa ainda não leu (bolinha na engrenagem). */
  novidadeNova: boolean;
};
export type TelaConfig = 'fechada' | 'menu' | 'notas';
export type Acoes = {
  abrirCnpj(): void; comprar(tipo: 'gerador' | 'melhoria', id: number, qtd: 0 | 1 | 10): void; escolher(era: number, opcao: number): void;
  pegar(janela: number): void; trocarAba(aba: Aba): void; caixa(aberta: boolean): void; tentarDeNovo(): void;
  contratar(userId: string): void; editor(acao: AcaoEditor): void; mudarVisual(campo: Campo, valor: number): void;
  vender(acao: 'abrir' | 'fechar' | 'confirmar'): void; comprarNo(id: number): void;
  horta(acao: 'abrir' | 'fechar'): void; plantar(canteiro: number, especie: number): void; colher(canteiro: number): void; arrancar(canteiro: number): void;
  bolsa(acao: 'abrir' | 'fechar'): void; negociar(empresa: number, lado: LadoBolsa, qtd: 0 | 1 | 10, tick: number, lote?: number): void;
  convidados(acao: 'abrir' | 'fechar'): void; sentar(cadeira: number, convidado: number): void; tirar(cadeira: number): void;
  melhorar(tipo: MelhoriaBolsa, nivel: number): void;
  mapa(acao: 'abrir' | 'fechar'): void; // abre/fecha a tela cheia do mapa (fecha Bolsa/Horta/Convidados)
  lugar(id: number | null): void; // entra num lugar aberto (null = volta pro mapa)
  abrirLugar(id: number): void; // compra (idle_place_abrir)
  subirNivel(id: number): void; // idle_place_nivel
  lugarAcao(fn: string, args: Record<string, unknown>): void; // mecânica de lugar (partes 2 a 4)
  lugarRecarregar(): void; // a mecânica pede o lugar de novo (chegou a hora de algo: a coleção ficou pronta)
  config(acao: 'abrir' | TelaConfig): void; chave(qual: ChaveSom, ligada: boolean): void; efeito(id: IdEfeito): void; volumeMusica(v: number): void;
  pegarDourado(seg: number, lado: number): void;
};
export type Tela = {
  canvas: HTMLCanvasElement; renderizar(m: Modelo): void; atualizarValor(valor: number): void; relogioBolsa(ms: number): void; fatal(texto: string): void;
  /** Eventos na tela (tipo cookie dourado). */
  dourados: ReturnType<typeof criarDouradoTela>;
  /** Selos do Viralizou e da Promoção com o tempo que falta. */
  relogioBonus(s: IdleState | null, agoraMs: number): void;
  /** Oportunidade nova caiu na Caixinha: a gaveta pula e brilha (junto do "plim"). */
  chegouOportunidade(): void;
  /** Recado no estúdio dos Convidados ("São a mesma pessoa?"). */
  recadoConvidados(texto: string | null): void;
};

/** Bolsa sem trader: só o aviso pra abrir (sem buscar nada). */
const VAZIA: BolsaEstado = { tick: 0, vira_em_ms: 0, r: 0, aberta: false, corretor: 0, escritorio: 0, corretagem: 0.05, empresas: [], carteira: [], viraram_po: [] };
const mostrar = (n: HTMLElement, sim: boolean) => (sim ? n.removeAttribute('hidden') : n.setAttribute('hidden', ''));
const ERRO_GALERA = 'Não deu pra carregar a galera. Tenta de novo.';
const NIVEL = ['bronze', 'prata', 'ouro', 'roxo', 'diamante', 'rubi', 'esmeralda', 'cosmo'];


/** "Some em 3h12" / "Some em 40 min": quanto falta pra oportunidade guardada sumir. */
export function prazo(ms: number) {
  const min = Math.ceil(ms / 60000);
  if (min <= 1) return 'Some em menos de 1 min';
  if (min < 60) return `Some em ${min} min`;
  return `Some em ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
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

export function criarTela(root: HTMLElement, a: Acoes, desenhar: Desenhar = () => undefined): Tela {
  const app = el('div', 'app idle');
  // PC: a base de 1280 × 720 cresce com a janela (zoom); a cena só por inteiro (escala.ts)
  const escalar = () => {
    const e = escalaPc(window.innerWidth, window.innerHeight);
    const pc = e.cena > 0;
    app.style.zoom = pc ? String(e.zoom) : '';
    app.style.height = pc ? `${window.innerHeight / e.zoom}px` : '';
    app.style.width = pc ? `${e.largura}px` : '';
    app.style.marginInline = pc ? 'auto' : '';
    app.style.setProperty('--zoom', pc ? String(e.zoom) : ''); // o que usa dvh/vh divide por ele (o zoom multiplica)
    app.style.setProperty('--cena-w', pc ? `${(160 * e.cena) / e.zoom}px` : '');
    app.style.setProperty('--cena-h', pc ? `${(96 * e.cena) / e.zoom}px` : '');
  };
  escalar();
  window.addEventListener('resize', escalar);
  // som da interface: navegação clica (comprar, vender e pegar têm o som do que deu certo, no main)
  const CLIQUE = '.aba, .seg button, .gaveta, .fechar, .config-item, .chave, .acao, .voltar-config, .no-arvore, .conquista, .topo-config';
  app.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest(CLIQUE)) a.efeito('clique');
  });
  // volume da música: a barra é criada uma vez só (refazer no meio do arraste soltaria o dedo)
  const linhaVolume = el('div', 'config-item config-volume');
  const barraVolume = el('input', 'volume');
  barraVolume.type = 'range';
  barraVolume.min = '0';
  barraVolume.max = '100';
  barraVolume.step = '5';
  barraVolume.setAttribute('aria-label', 'Volume da música');
  const valorVolume = el('span', 'volume-valor');
  const textoVolume = (pct: number) => (pct === 0 ? 'Desligada' : `${pct}%`);
  const mostrarVolume = (pct: number) => {
    valorVolume.textContent = textoVolume(pct);
    barraVolume.setAttribute('aria-valuetext', textoVolume(pct));
  };
  barraVolume.addEventListener('input', () => {
    const pct = Number(barraVolume.value);
    mostrarVolume(pct);
    a.volumeMusica(pct / 100);
  });
  linhaVolume.append(el('span', 'rotulo', 'Música'), barraVolume, valorVolume);
  // folha abrindo e fechando ("fuu" subindo e descendo); a 1ª vez só registra
  const folhaVisivel = new WeakMap<HTMLElement, boolean>();
  const mostrarFolha = (modal: HTMLElement, visivel: boolean) => {
    const antes = folhaVisivel.get(modal);
    folhaVisivel.set(modal, visivel);
    mostrar(modal, visivel);
    if (antes !== undefined && antes !== visivel) a.efeito(visivel ? 'abrir' : 'fechar');
  };
  const topo = el('header', 'top');
  const voltar = el('a', undefined, '← Voltar');
  voltar.href = '/games';
  // Configurações (som, visual, patch notes); a bolinha avisa patch note não lida
  const engrenagem = button('', 'btn topo-config', () => a.config('abrir'));
  const pontoNovo = el('span', 'ponto');
  engrenagem.append(iconeEngrenagem(), pontoNovo);
  topo.append(voltar, el('span', 'marca', 'Fellas Inc.'), engrenagem);

  const palco = el('div', 'palco');
  const canvas = el('canvas', 'cena');
  palco.append(canvas);
  // aviso de conquista: no topo da tela inteira (não mais no meio da cena); tocar abre a conquista no Legado
  const avisoConquista = button('', 'conquista-aviso', () => verConquista());
  avisoConquista.setAttribute('aria-live', 'polite');
  avisoConquista.setAttribute('hidden', '');
  let avisoMostrado: AvisoConquista | null = null;
  /** A conquista que o aviso mandou ver: pisca na grade (e no celular já abre o detalhe). */
  let destaque: number | null = null;
  /** PC com mouse: a conquista mostra a caixinha ao passar o mouse; celular: tocar abre o detalhe embaixo. */
  const temMouse = () => typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function verConquista() {
    if (!avisoMostrado) return;
    destaque = avisoMostrado.id;
    if (destaque !== null && !temMouse()) conquistaAberta = destaque;
    a.trocarAba('legado');
  }
  function desenharAviso(av: AvisoConquista | null) {
    if (av === avisoMostrado) return;
    avisoMostrado = av;
    mostrar(avisoConquista, av !== null);
    if (!av) return;
    const meio = el('span', 'meio');
    meio.append(el('span', 'rot', av.id === null ? 'Conquistas' : 'Conquista desbloqueada · +1% de produção'), el('strong', undefined, av.nome), el('span', 'frase', av.frase));
    avisoConquista.replaceChildren(iconeLegado(av.id === null ? null : ativos.conquista(av.id)), meio, el('span', 'ver', 'Ver →'), el('i', 'barra'));
    avisoConquista.setAttribute('aria-label', `${av.id === null ? '' : 'Conquista desbloqueada: '}${av.nome}. ${av.frase} Abrir no Legado`);
  }

  const placa = el('div', 'valor');
  const numero = el('div', 'numero', 'F$ 0');
  const taxaTxt = el('div', 'taxa', '');
  taxaTxt.tabIndex = 0;
  const bonus = el('div', 'bonus', '');
  // Viralizou / Promoção valendo: selos com o tempo que falta (relogioBonus, a cada passo da página)
  const selos = el('div', 'selos');
  // resumo (o PC mostra do lado da cena; o celular esconde .info pelo CSS)
  const info = el('div', 'info');
  placa.append(numero, taxaTxt, selos, bonus, info);
  // caixinhas de informação (dica.ts): o F$/s do topo, os geradores, as melhorias, os contratos e os convidados
  const dicas = criarDicas(app);
  const convidadosTela = criarConvidadosTela({ sentar: (c, id) => a.sentar(c, id), tirar: (c) => a.tirar(c) }, dicas.ligar);
  dicas.ligar(taxaTxt, 'producao', () => (ultimo?.estado ? dicaProducao(ultimo.estado, agoraTela) : null));
  // Mapa do rolê: caixinhas de uma frase (título em cima, o texto de dica.ts embaixo)
  const dicasMapa: Dicas = {
    ligar: (alvo, chave, titulo, texto) => dicas.ligar(alvo, `mapa-${chave}`, () => {
      const t = texto();
      return t === null ? null : { titulo, linhas: [{ texto: t }] };
    }),
  };

  const abrir = el('div', 'abrir');
  abrir.append(
    el('p', undefined, '3h06. Bora fundar uma empresa?'),
    button('Abrir CNPJ', 'btn main', a.abrirCnpj),
    button('Mudar visual', 'btn', () => a.editor('abrir')),
  );
  // a empresa: cena + resumo (ou o Abrir CNPJ) num cartão, e a bancada embaixo
  const cartaoEmpresa = el('div', 'cartao-empresa');
  cartaoEmpresa.append(palco, placa, abrir);
  // bancada: as portas dos minigames (cada um abre em tela cheia) e a Caixinha das oportunidades guardadas
  const portas = el('div', 'portas');
  type Porta = { botao: HTMLButtonElement; st: HTMLElement; badge: HTMLElement };
  function porta(cls: string, nome: string, icone: string | null, abrirPorta: (() => void) | null): Porta {
    const botao = button('', `porta ${cls}`, () => abrirPorta?.());
    const ic = el('span', `porta-icone${icone && !icone.includes('mapa') ? ' quadros' : ''}`);
    if (icone) ic.style.backgroundImage = `url(${icone})`;
    const st = el('span', 'porta-st');
    const badge = el('span', 'porta-badge');
    mostrar(badge, false);
    botao.append(ic, el('strong', 'porta-nome', nome), st, el('span', 'porta-abrir', abrirPorta ? 'Abrir →' : 'Em breve'), badge);
    if (!abrirPorta) {
      botao.disabled = true;
      botao.classList.add('porta-breve');
      st.textContent = nome === 'Lives' ? 'Chega na Live na Twitch' : 'Os lugares do rolê';
    }
    portas.append(botao);
    return { botao, st, badge };
  }
  const pBolsa = porta('gaveta-bolsa', 'Bolsa', ativos.gerador(19), () => a.bolsa('abrir'));
  const pHorta = porta('gaveta-horta', 'Horta', ativos.gerador(11), () => a.horta('abrir'));
  const pConv = porta('gaveta-convidados', 'Convidados', ativos.gerador(13), () => a.convidados('abrir'));
  porta('porta-lives', 'Lives', ativos.gerador(6), null);
  const pMapa = porta('porta-mapa', 'Mapa do rolê', ativos.mapa(), () => a.mapa('abrir'));
  const gavetaBolsa = pBolsa.botao;
  const gavetaHorta = pHorta.botao;
  const gavetaConv = pConv.botao;
  // a Caixinha: o cabeçalho (quantas tem e quantas ainda dá pra pegar hoje) e as guardadas lado a lado
  const gavetaCaixa = el('div', 'bancada-caixa-cab');
  const selo = el('span', 'selo', '0');
  const caixaSub = el('span', 'sub');
  const caixaTitulo = el('strong', undefined, 'Caixinha');
  caixaTitulo.append(selo);
  gavetaCaixa.append(caixaTitulo, caixaSub);
  const corpoCaixa = el('div', 'bancada-caixa-itens');
  const caixinha = el('section', 'bancada-caixa');
  caixinha.setAttribute('aria-label', 'Caixinha');
  caixinha.append(gavetaCaixa, corpoCaixa);
  const hortaTela = criarHortaTela({ plantar: (c, e) => a.plantar(c, e), colher: (c) => a.colher(c), arrancar: (c) => a.arrancar(c) });
  const bolsaTela = criarBolsaTela({ negociar: (e, l, q, t, lote) => a.negociar(e, l, q, t, lote), melhorar: (tp, n) => a.melhorar(tp, n) });
  const mapaTela = criarMapaTela({ entrar: (id) => a.lugar(id), abrir: (id) => a.abrirLugar(id) }, dicasMapa, (v) => boneco(v, null));
  const lugarTela = criarLugarTela({ voltar: () => a.lugar(null), nivel: (id) => a.subirNivel(id), acao: (fn, args) => a.lugarAcao(fn, args), recarregar: () => a.lugarRecarregar(), usuario: () => ultimo?.estado?.user_id ?? null }, dicasMapa, (v) => boneco(v, null));
  // o minigame aberto, em tela cheia (como a árvore): Voltar, o ícone, o nome e o F$
  let gavetaAberta: 'bolsa' | 'horta' | 'convidados' | 'mapa' | null = null;
  // no Mapa do rolê, dentro de um lugar o Voltar volta pro mapa (não fecha a tela cheia)
  const fecharMinigame = () => (gavetaAberta === 'mapa' ? (ultimo?.lugarAberto != null ? a.lugar(null) : a.mapa('fechar'))
    : gavetaAberta === 'horta' ? a.horta('fechar') : gavetaAberta === 'convidados' ? a.convidados('fechar') : a.bolsa('fechar'));
  const telaCheia = el('div', 'minigame-tela');
  telaCheia.setAttribute('role', 'dialog');
  telaCheia.setAttribute('aria-modal', 'true');
  telaCheia.setAttribute('aria-labelledby', 'idle-titulo-minigame');
  telaCheia.setAttribute('hidden', '');
  const bancadaTopo = el('div', 'minigame-topo');
  const fecharBolsa = button('← Voltar', 'btn voltar-minigame', fecharMinigame);
  const iconeMinigame = el('span', 'porta-icone quadros');
  const tituloGaveta = el('h2', undefined, 'Bolsa');
  tituloGaveta.id = 'idle-titulo-minigame';
  const valorBolsa = el('span', 'chip-valor');
  bancadaTopo.append(fecharBolsa, iconeMinigame, tituloGaveta, el('span', 'espaco'), valorBolsa);
  const corpoBancada = el('div', 'minigame-corpo');
  telaCheia.append(bancadaTopo, corpoBancada);
  telaCheia.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMinigame(); });
  // a Bolsa e a Horta continuam no corpo entre um desenho e outro: tirar e pôr de volta zeraria a rolagem delas
  const noCorpo = (n: HTMLElement) => {
    if (corpoBancada.childNodes.length !== 1 || corpoBancada.firstChild !== n) corpoBancada.replaceChildren(n);
  };
  const bancada = el('section', 'bancada');
  bancada.setAttribute('aria-label', 'Bancada');
  bancada.append(portas, caixinha);
  const empresa = el('div', 'empresa');
  empresa.append(cartaoEmpresa, bancada);


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
  painel.append(abas, segLoja, listaG, listaM, listaC, listaP, listaL);

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
  const modalCfg = el('div', 'modal modal-config');
  modalCfg.hidden = true; // até o primeiro render
  for (const [modal, titulo] of [
    [modalE, 'idle-titulo-estrategia'], [modalC, 'idle-titulo-caixa'], [modalV, 'idle-titulo-visual'], [modalP, 'idle-titulo-venda'],
    [modalCfg, 'idle-titulo-config'],
  ] as const) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', titulo);
  }
  const titulo = (id: string, texto: string) => {
    const h = el('h2', undefined, texto);
    h.id = id;
    return h;
  };  // árvore de habilidades em tela cheia (por cima de tudo, menos dos avisos)
  const arvore = criarArvoreTela((id) => a.comprarNo(id));


  app.append(topo, empresa, painel, notice, overlay, modalE, modalC, modalV, modalP, modalCfg, arvore.elemento, telaCheia, avisoConquista);
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

  // Promoção relâmpago valendo: custo pela metade; a meia-preço da Caixinha não soma (o banco faz igual)
  let agoraTela = Date.now();
  const custoAgora = (s: IdleState) => custoMult(catalogo, s) * (promoAtiva(s, agoraTela) ? 0.5 : 1);
  // a horta: geradores e melhorias mais baratos (o banco aplica igual)
  const custoGerador = (s: IdleState) => custoAgora(s) * (1 - (s.horta_bonus?.geradores ?? 0)) * custosConv(s).geradores;
  const custoMelhoria = (s: IdleState) => custoAgora(s) * (1 - (s.horta_bonus?.melhorias ?? 0)) * custosConv(s).melhorias;
  const meiaAgora = (s: IdleState) => (s.half_price && !promoAtiva(s, agoraTela) ? 0.5 : 1);

  function linhaGerador(s: IdleState, gid: number) {
    const g = catalogo.geradores[gid - 1];
    const n = s.generators[gid - 1];
    const linha = el('div', 'gerador');
    const sprite = el('div', 'sprite');
    sprite.style.backgroundImage = `url(${ativos.gerador(gid)})`;
    const meio = el('div', 'meio');
    meio.append(el('strong', undefined, g.nome), el('span', 'sub', `×${n} · ${formatarTaxa(taxaPorUnidade(catalogo, s, gid) * (1 + (s.horta_bonus?.producao ?? 0)) * multGerador(s, gid, agoraTela) * (s.mapa_mult ?? 1))} cada`));
    // ligado a uma empresa da Bolsa: cada um libera +1 ação dela (só depois de abrir a Bolsa)
    const ligada = (s.generators[18] ?? 0) >= 1 ? empresaDoGerador(gid) : undefined;
    if (ligada) {
      const etq = el('span', 'etq-bolsa', `Bolsa: +1 ${ligada.codigo} cada`);
      etq.title = `Cada ${g.nome} libera +1 ação ${deEmpresa(ligada)} ${ligada.nome} na Bolsa`;
      meio.append(etq);
    }
    const cm = custoGerador(s);
    const botoes = el('div', 'compra');
    const um = button(formatarValor(preco(g.custo, n, 1, cm) * meiaAgora(s)), 'btn', () => a.comprar('gerador', gid, 1));
    um.dataset.qtd = '1';
    const dez = button('10', 'btn', () => a.comprar('gerador', gid, 10));
    dez.dataset.qtd = '10';
    const max = button('Máx', 'btn', () => a.comprar('gerador', gid, 0));
    max.dataset.qtd = '0';
    precos.push(
      { botao: um, preco: preco(g.custo, n, 1, cm) * meiaAgora(s) },
      { botao: dez, preco: preco(g.custo, n, 10, cm) },
      { botao: max, preco: preco(g.custo, n, 1, cm), maximo: { custo: g.custo, n, cm } },
    );
    botoes.append(um, dez, max);
    linha.append(sprite, meio, botoes);
    dicas.ligar(linha, `g${gid}`, () => dicaGerador(s, gid, preco(g.custo, n, 1, cm) * meiaAgora(s)));
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

  /** Aba Legado: os pontos e o Vender, o quadro da árvore (Abrir leva pra tela cheia) e as conquistas em grade de
   *  ícones (tocar mostra a frase e a data). */
  function legado(s: IdleState, ocupado: boolean) {
    const topoL = el('div', 'legado-pontos');
    const meio = el('div', 'meio');
    const num = el('strong', 'legado-num');
    num.append(el('span', 'estrela', '★ '), document.createTextNode(pontos(s.pontos)));
    const vezes = s.vendas === 1 ? 'vendeu 1 vez' : `vendeu ${s.vendas} vezes`;
    meio.append(num, el('span', 'sub', `${s.pontos_vida} na vida · recorde ${formatarTaxa(s.recorde)}${s.vendas ? ` · ${vezes}` : ''}`));
    const vender = button(s.pontos_venda >= 1 ? `Vender · +${s.pontos_venda} ★` : 'Ainda não compensa', 'btn', () => a.vender('abrir'));
    if (s.pontos_venda >= 1) vender.setAttribute('aria-label', `Vender a startup e ganhar ${pontos(s.pontos_venda)}`);
    vender.disabled = s.pontos_venda < 1 || ocupado;
    topoL.append(meio, vender);

    const comprados = s.bonus.arvore.length;
    const podem = catalogo.arvore.filter((n) => situacaoTela(n, s.bonus.arvore, s.pontos) === 'pode').length;
    const quadro = el('div', 'arvore-quadro');
    const textoQ = el('div', 'meio');
    const abrirB = button('Abrir', 'btn main arvore-abrir', () =>
      arvore.abrir(s, ocupado, () => listaL.querySelector<HTMLElement>('.arvore-abrir')));
    textoQ.append(
      el('strong', undefined, 'Árvore de habilidades'),
      el('span', 'sub', `${comprados} de ${catalogo.arvore.length} comprados${podem ? ` · ${podem} dá pra comprar agora` : ''}`),
      abrirB,
    );
    quadro.append(miniArvore(s), textoQ);

    const celulas = grade(s);
    const cab = el('div', 'legado-cab');
    cab.append(el('h3', 'legado-titulo', 'Conquistas'), el('span', 'sub', `${s.conquistas.length}/${TOTAL_CONQUISTAS} · +${s.bonus.conquistas}% de produção`));
    const grid = el('div', 'grade-conquistas');
    for (const c of celulas) {
      const oculta = !c.ganhou && c.nome === '???';
      const b = button(oculta ? '?' : '', `conquista${c.ganhou ? ' ganha' : ''}${oculta ? ' oculta' : ''}${destaque === c.conquista.id ? ' destaque' : ''}`, () => {
        destaque = null;
        if (temMouse()) return; // no PC quem mostra é a caixinha (mouse/foco)
        conquistaAberta = conquistaAberta === c.conquista.id ? null : c.conquista.id;
        if (ultimo) renderizar(ultimo);
      });
      dicas.ligar(b, `conquista-${c.conquista.id}`, () => dicaConquista(c));
      if (destaque === c.conquista.id) queueMicrotask(() => b.scrollIntoView?.({ block: 'center', behavior: 'smooth' }));
      b.setAttribute('aria-label', `${c.nome}, ${c.ganhou ? 'ganha' : 'não ganha'}`);
      b.setAttribute('aria-pressed', String(conquistaAberta === c.conquista.id));
      if (!oculta) b.append(iconeLegado(ativos.conquista(c.conquista.id)));
      grid.append(b);
    }
    listaL.append(topoL, quadro, cab, grid);
    const aberta = celulas.find((c: Celula) => c.conquista.id === conquistaAberta);
    if (aberta) {
      const det = el('div', 'conquista-detalhe');
      const texto = el('div', 'meio');
      texto.append(el('strong', undefined, aberta.nome), el('span', aberta.ganhou ? 'frase' : 'sub', aberta.texto));
      if (aberta.feito) texto.append(el('span', 'feito', `✓ Feito: ${aberta.feito}`));
      if (aberta.em) texto.append(el('span', 'sub', ganhouEm(aberta.em)));
      det.append(iconeLegado(aberta.nome === '???' ? null : ativos.conquista(aberta.conquista.id)), texto);
      listaL.append(det);
    }
  }

  /** O miolo da caixinha: quantas ainda dá pra pegar hoje e uma linha por guardada. Serve pra folha do celular e pra
   *  gaveta da bancada no PC (mesmas regras de botão apagado). */
  function itensCaixinha(s: IdleState, m: Modelo): HTMLElement[] {
    const out: HTMLElement[] = [el('p', 'sub', s.opp_left > 0 ? `Hoje ainda dá pra pegar ${s.opp_left}.` : 'Já pegou todas de hoje. Amanhã tem mais.')];
    if (!m.pendentes.length) {
      out.push(el('p', 'vazio', 'Nada guardado agora. Volta mais tarde.'));
      return out;
    }
    const lista = el('ul', 'escolhas');
    for (const w of m.pendentes) {
      const k = tipoOportunidade(s.user_id, w);
      const li = el('li', 'escolha');
      const bonequinho = el('div', 'boneco');
      bonequinho.style.backgroundImage = `url(${ativos.oportunidade(k)})`;
      const texto = el('div', 'escolha-texto');
      const quando = el('span', 'sub prazo', '');
      texto.append(el('strong', undefined, TEXTO_TIPO[k]), quando);
      dicas.ligar(li, `opp-${w}`, () => dicaOportunidade(s, k, agoraTela));
      prazos.push({ texto: quando, fim: sai(s.user_id, w, caixa(s).tamanho) });
      // desde a 0062 tudo empilha: outra meia-preço guardada vale mais uma compra pela metade
      const b = button('Pegar', 'btn main compacto', () => a.pegar(w));
      b.disabled = m.ocupado || s.opp_left <= 0;
      li.append(bonequinho, texto, b);
      lista.append(li);
    }
    out.push(lista);
    return out;
  }

  function renderizar(m: Modelo) {
    ultimo = m;
    const s = m.estado;
    agoraTela = m.agora ?? (s ? Date.parse(s.server_now) : Date.now());
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
    // bancada: as portas (com o resumo de cada minigame) e a Caixinha com as guardadas
    selo.textContent = String(m.pendentes.length);
    mostrar(selo, m.pendentes.length > 0);
    gavetaCaixa.setAttribute('aria-label', `Caixinha: ${m.pendentes.length} ${m.pendentes.length === 1 ? 'oportunidade guardada' : 'oportunidades guardadas'}`);
    caixaSub.textContent = s ? (s.opp_left > 0 ? `Hoje ainda dá pra pegar ${s.opp_left}` : 'Já pegou todas de hoje') : '';
    mostrar(bancada, jogando);
    const trader = (s?.generators[18] ?? 0) >= 1; // gerador 19 (Grupo de trader) = índice 18 aqui
    const foodTruck = (s?.generators[10] ?? 0) >= 1; // gerador 11 (Food truck)
    if (s) {
      const resumos: [Porta, ResumoPorta, string][] = [
        [pBolsa, portaBolsa(s, m.bolsa), 'Bolsa'],
        [pHorta, portaHorta(s, m.horta, agoraTela), 'Horta'],
        [pConv, portaConvidados(s, agoraTela), 'Convidados'],
        [pMapa, portaMapa(s, m.mapa), 'Mapa do rolê'],
      ];
      for (const [p, r, nome] of resumos) {
        p.st.textContent = r.st;
        p.badge.textContent = r.badge ?? '';
        mostrar(p.badge, r.badge !== null);
        p.botao.classList.toggle('trancada', r.trancada);
        p.botao.setAttribute('aria-label', `${nome}: ${r.st}${r.badge ? ` (${r.badge})` : ''}`);
      }
    }
    gavetaAberta = !jogando ? null : m.mapaAberto ? 'mapa' : m.convidadosAberto ? 'convidados' : m.hortaAberta ? 'horta' : m.bolsaAberta ? 'bolsa' : null;
    const abriuAgora = gavetaAberta !== null && telaCheia.hasAttribute('hidden');
    mostrar(telaCheia, gavetaAberta !== null);
    telaCheia.dataset.minigame = gavetaAberta ?? '';
    app.classList.toggle('com-minigame', gavetaAberta !== null);
    const NOMES_MINI = {
      bolsa: ['Bolsa', ativos.gerador(19)], horta: ['Horta do Food truck', ativos.gerador(11)], convidados: ['Convidados no PPP Podcast', ativos.gerador(13)],
      mapa: ['Mapa do rolê', ativos.mapa()],
    } as const;
    const noLugar = gavetaAberta === 'mapa' && m.lugarAberto !== null;
    telaCheia.dataset.lugar = noLugar ? String(m.lugarAberto) : '';
    aplicarTema(telaCheia, noLugar ? m.lugarAberto : null); // dentro de um lugar, o topo e o fundo com as cores dele
    if (gavetaAberta) {
      let [titulo, icone]: [string, string | null] = [...NOMES_MINI[gavetaAberta]];
      if (noLugar) {
        // dentro de um lugar: o nome e o ícone dele (do lugar buscado ou, carregando, do pino do mapa)
        const pino = m.mapa?.lugares.find((p) => p.id === m.lugarAberto);
        const id = m.lugarAberto as number;
        titulo = nomeLugar(m.lugar ?? pino ?? { id, nome: null });
        icone = m.lugar?.icone ?? pino?.icone ?? ativos.mapa();
      }
      tituloGaveta.textContent = titulo;
      tituloGaveta.dataset.curto = noLugar ? titulo : { bolsa: 'Bolsa', horta: 'Horta', convidados: 'Convidados', mapa: 'Mapa do rolê' }[gavetaAberta];
      iconeMinigame.style.backgroundImage = icone ? `url(${icone})` : '';
      iconeMinigame.classList.toggle('quadros', gavetaAberta !== 'mapa'); // sprite de gerador (4 quadros); o do mapa é um quadro só
    }
    if (gavetaAberta === 'mapa' && s) {
      if (noLugar) {
        // o prêmio "Investidor na hora" do desafio paga o mesmo que o Investidor apressado (com o Investidor anjo e a horta)
        const investidor = ganhoInvestidor(s.rate, efeitosDe(catalogo, s).douradoInvestidor, s.horta_bonus?.oportunidades ?? 0);
        lugarTela.renderizar(m.lugar, m.ocupado, agoraTela, m.nomesLugar, investidor);
        noCorpo(lugarTela.elemento);
      } else {
        mapaTela.renderizar(m.mapa, s.valuation, s.era, m.ocupado);
        noCorpo(mapaTela.elemento);
      }
    } else if (gavetaAberta === 'convidados' && s) {
      convidadosTela.renderizar(s, m.ocupado, agoraTela);
      noCorpo(convidadosTela.elemento);
    } else if (gavetaAberta === 'horta' && s) {
      const semHorta: HortaEstado = { lado: 0, food_trucks: 0, plantas: [], descobertas: [1, 2], bonus: { producao: 0, geradores: 0, melhorias: 0, oportunidades: 0 }, server_now: s.server_now };
      // a semente custa minutos da produção; com o Viniccius13 sentado, 50% mais (× o peso)
      const taxaSemente = s.rate * (1 + 0.5 * peso(s.convidados ?? SEM_CADEIRAS, s.generators[12] ?? 0, VINI));
      // o Terry e o Viniccius13 sentados aparecem do lado da horta, com o efeito na cadeira deles
      const cad = s.convidados ?? SEM_CADEIRAS;
      const chips = [TERRY, VINI].flatMap((id) => {
        const p = peso(cad, s.generators[12] ?? 0, id);
        if (!p) return [];
        const [bom, ruim] = efeitosTexto(id, p);
        return [{ retrato: ativos.convidado(id), titulo: `${id === TERRY ? 'Terry' : 'Vini'} ${['na frente', 'no meio', 'no canto'][cad.cadeira.indexOf(id)]}`, bonus: bom, defeito: ruim }];
      });
      hortaTela.renderizar(foodTruck ? m.horta : semHorta, taxaSemente, s.valuation, m.ocupado, agoraTela, chips, efeitosDe(catalogo, s).hortaMult);
      noCorpo(hortaTela.elemento);
    } else if (gavetaAberta === 'bolsa' && s) {
      bolsaTela.renderizar(trader ? m.bolsa : { ...(m.bolsa ?? VAZIA), aberta: false }, s.valuation, m.ocupado, 1 + peso(s.convidados ?? SEM_CADEIRAS, s.generators[12] ?? 0, VORCARO));
      noCorpo(bolsaTela.elemento);
    } else corpoBancada.replaceChildren();
    if (abriuAgora) {
      dicas.esconder(); // a caixinha de um item da tela de trás (o mouse estava em cima) não fica por cima do minigame
      fecharBolsa.focus({ preventScroll: true });
    }
    corpoCaixa.replaceChildren(...(s && jogando ? itensCaixinha(s, m).slice(1) : []));
    mostrar(engrenagem, jogando || m.fase === 'antes');
    engrenagem.setAttribute('aria-label', m.novidadeNova ? 'Configurações (tem novidade)' : 'Configurações');
    mostrar(pontoNovo, m.novidadeNova);
    app.classList.toggle('sem-painel', !jogando && !verLegado);
    mostrar(listaL, verLegado);

    listaG.replaceChildren();
    listaM.replaceChildren();
    if (s && jogando) {
      taxaTxt.textContent = formatarTaxa(s.rate);
      info.replaceChildren(el('span', undefined, rotuloEra(s.era, (s.generators[29] ?? 0) > 0)));
      if (s.equipe.length) info.append(el('span', undefined, s.equipe.length === 1 ? '1 contratado' : `${s.equipe.length} contratados`));
      if (s.bonus.conquistas > 0) info.append(el('span', undefined, `+${s.bonus.conquistas}% das conquistas`));
      const naFrente = s.convidados?.cadeira[0];
      if (naFrente && destrancada(0, s.generators[12] ?? 0)) info.append(el('span', undefined, `${CONVIDADOS.find((c) => c.id === naFrente)?.nome} na frente do PPP`));
      const cincos = (s.boosts ?? (s.boost_until ? [s.boost_until] : [])).filter((t) => Date.parse(t) > Date.parse(s.server_now)).length;
      const meias = s.meias ?? (s.half_price ? 1 : 0);
      bonus.textContent = cincos
        ? `Produção ×${(5 * cincos).toLocaleString('pt-BR')} por alguns segundos`
        : meias > 1 ? `Próximas ${meias} compras pela metade` : meias === 1 ? 'Próxima compra pela metade' : '';
      for (let gid = 1; gid <= 30; gid++) {
        if (podeComprarGerador(s, gid)) listaG.append(linhaGerador(s, gid));
        else {
          listaG.append(linhaTrancada(gid));
          break;
        }
      }
      const cm = custoMelhoria(s);
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
          dicas.ligar(item, `m${x.id}`, () => dicaMelhoria(s, x, null));
          listaM.append(item);
        }
      }
      if (!verCompradas && !disponiveis.length) listaM.append(el('p', 'vazio', 'Nenhuma melhoria liberada agora. Compra mais geradores.'));
      for (const x of verCompradas ? [] : disponiveis) {
        const item = el('div', 'melhoria');
        const meio = el('div', 'meio');
        meio.append(el('strong', undefined, x.nome), el('span', 'sub', x.frase));
        const p = x.preco * cm * meiaAgora(s);
        const comprar = button(formatarValor(p), 'btn', () => a.comprar('melhoria', x.id, 1));
        precos.push({ botao: comprar, preco: p });
        item.append(iconeMelhoria(x), meio, comprar);
        dicas.ligar(item, `m${x.id}`, () => dicaMelhoria(s, x, p));
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
      texto.tabIndex = 0;
      dicas.ligar(texto, 'contratos', () => dicaContratos(s));
      topoC.append(boneco(s.avatar, 'Seu personagem'), texto, button('Mudar visual', 'btn', () => a.editor('abrir')));
      listaC.append(topoC);
      if (!m.placar) listaC.append(el('p', 'vazio', m.placarFalhou ? ERRO_GALERA : 'Carregando…'));
      else {
        const outros = m.placar.filter((r) => r.userId !== s.user_id);
        if (!outros.length) listaC.append(el('p', 'vazio', 'Ninguém mais abriu a empresa ainda. Chama a galera.'));
        for (const r of outros) {
          const carta = el('div', 'carta');
          const meio = el('div', 'meio');
          meio.append(el('strong', undefined, r.name), el('span', 'sub', `${rotuloEra(r.era, r.orbita, true)} · ${empresas(r.hiredCount)}`));
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
    // a árvore aberta acompanha o estado novo; saiu do Legado (venda, sessão caiu): fecha
    if (arvore.aberta()) {
      if (s && verLegado) arvore.renderizar(s, m.ocupado);
      else arvore.fechar();
    }

    listaP.replaceChildren();
    if (!m.placar) listaP.append(el('li', 'vazio', m.placarFalhou ? ERRO_GALERA : 'Carregando…'));
    else {
      if (!m.placar.length) listaP.append(el('li', 'vazio', 'Ninguém abriu a empresa ainda.'));
      m.placar.forEach((r, i) => {
        const li = el('li', r.userId === s?.user_id ? 'eu' : undefined);
        // a era é a cena em que a pessoa está (cena 1 = era 1, cena 2 = era 2...)
        li.append(
          el('span', 'pos', `${i + 1}º`), boneco(r.avatar, null), el('span', 'nome', r.name),
          el('span', 'sub', rotuloEra(r.era, r.orbita)), el('span', 'v', formatarTaxa(r.rate)),
        );
        if (r.pontos > 0) li.append(el('span', 'pontos', `★ ${r.pontos}`));
        if (r.mostHired) li.append(el('span', 'disputado', 'Mais disputado da semana'));
        listaP.append(li);
      });
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
    mostrarFolha(modalC, m.caixaAberta && jogando);
    if (s && m.caixaAberta) {
      const folha = el('div', 'folha');
      const topo = el('div', 'folha-topo');
      const fechar = button('', 'fechar', () => a.caixa(false));
      fechar.setAttribute('aria-label', 'Fechar');
      fechar.append(iconeFechar());
      topo.append(titulo('idle-titulo-caixa', 'Oportunidades guardadas'), fechar);
      folha.append(topo, ...itensCaixinha(s, m));
      modalC.append(folha);
      atualizarPrazos();
    }

    // editor de personagem
    modalV.replaceChildren();
    mostrarFolha(modalV, m.editor !== null && (m.fase === 'antes' || jogando));
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
    mostrarFolha(modalP, ganho >= 1);
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

    // configurações: menu (som, visual, patch notes) ou as patch notes
    const naBarra = document.activeElement === barraVolume; // refazer a folha tira o foco: guarda e devolve
    modalCfg.replaceChildren();
    mostrarFolha(modalCfg, m.config !== 'fechada');
    if (m.config !== 'fechada') {
      const folha = el('div', 'folha folha-config');
      const topoCfg = el('div', 'folha-topo');
      const fechar = button('', 'fechar', () => a.config('fechada'));
      fechar.setAttribute('aria-label', 'Fechar');
      fechar.append(iconeFechar());
      if (m.config === 'menu') {
        topoCfg.append(titulo('idle-titulo-config', 'Configurações'), fechar);
        if (!naBarra) {
          const pct = Math.round(m.volumeMusica * 100);
          barraVolume.value = String(pct);
          mostrarVolume(pct);
        }
        const chaveSom = (qual: ChaveSom, rotulo: string, ligado: string, desligado: string) => {
          const linha = el('div', 'config-item');
          const on = m.chaves[qual];
          const b = button(on ? ligado : desligado, `chave${on ? ' ligada' : ''}`, () => a.chave(qual, !on));
          b.setAttribute('role', 'switch');
          b.setAttribute('aria-checked', String(on));
          b.setAttribute('aria-label', rotulo);
          linha.append(el('span', 'rotulo', rotulo), b);
          return linha;
        };
        const item = (rotulo: string, sub: string, aoTocar: () => void, ponto = false) => {
          const b = button('', 'config-item', aoTocar);
          const p = el('span', 'ponto');
          mostrar(p, ponto);
          const texto = el('span', 'meio');
          texto.append(el('span', 'rotulo', rotulo), el('span', 'sub', sub));
          b.append(texto, p);
          return b;
        };
        folha.append(
          topoCfg,
          linhaVolume,
          chaveSom('efeitos', 'Efeitos sonoros', 'Ligados', 'Desligados'),
          chaveSom('avisos', 'Avisos', 'Ligados', 'Desligados'),
          item('Mudar visual', 'Seu boneco nas cenas e no placar', () => { a.config('fechada'); a.editor('abrir'); }),
          item('Patch notes', 'O que entrou de novo no jogo', () => a.config('notas'), m.novidadeNova),
        );
      } else {
        const voltarCfg = button('Voltar', 'btn voltar-config', () => a.config('menu'));
        topoCfg.append(voltarCfg, titulo('idle-titulo-config', 'Patch notes'), fechar);
        const lista = el('div', 'notas');
        for (const n of NOVIDADES) {
          const nota = el('section', 'nota');
          const cab = el('div', 'nota-cab');
          cab.append(el('h3', undefined, n.titulo), el('span', 'sub', dataNovidade(n.data)));
          const ul = el('ul');
          for (const t of n.itens) ul.append(el('li', undefined, t));
          nota.append(cab, ul);
          lista.append(nota);
        }
        folha.append(topoCfg, lista);
      }
      modalCfg.append(folha);
      if (naBarra && barraVolume.isConnected) barraVolume.focus();
    }

    desenharAviso(m.conquistaAviso);

    noticeTxt.textContent = m.aviso ?? '';
    mostrar(notice, !!m.aviso);
    overlayTxt.textContent = 'Entra no fellas pra jogar';
    mostrar(entrar, true);
    mostrar(deNovo, false);
    mostrar(overlay, m.fase === 'sem_sessao');
    dicas.conferir(); // a caixinha aberta segue a linha refeita (números novos) ou fecha
  }

  function atualizarPrazos() {
    const agora = Date.now();
    for (const p of prazos) p.texto.textContent = prazo(p.fim - agora);
  }

  function atualizarValor(valor: number) {
    numero.textContent = formatarValor(valor);
    valorBolsa.textContent = formatarValor(valor);
    atualizarPrazos();
    mapaTela.valor(valor);
    for (const p of [...bolsaTela.precos(), ...hortaTela.precos(), ...mapaTela.precos()]) p.botao.disabled = p.preco > valor;
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

  // eventos na tela, por cima de tudo
  const dourados = criarDouradoTela(app, (seg, lado) => a.pegarDourado(seg, lado));
  function relogioBonus(s: IdleState | null, agoraMs: number) {
    const lista = s ? selosBonus(s, agoraMs) : [];
    selos.replaceChildren(...lista.map((x) => el('span', `selo-bonus${x.ouro ? ' ouro' : ''}`, x.texto)));
  }

  let pulo: ReturnType<typeof setTimeout> | null = null;
  function chegouOportunidade() {
    caixinha.classList.remove('chegou');
    void caixinha.offsetWidth; // recomeça a animação se já estava pulando
    caixinha.classList.add('chegou');
    if (pulo) clearTimeout(pulo);
    pulo = setTimeout(() => caixinha.classList.remove('chegou'), 2000);
  }

  return { canvas, renderizar, atualizarValor, relogioBolsa: (ms: number) => bolsaTela.relogio(ms), fatal, dourados, relogioBonus, chegouOportunidade,
    recadoConvidados: (texto: string | null) => convidadosTela.recado(texto) };
}
