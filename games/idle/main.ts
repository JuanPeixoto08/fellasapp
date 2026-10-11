// Fellas Inc.: liga banco, tela e palco. O banco decide tudo; aqui só se pede, se mostra e se anima o número.
import '../shared/hud/hud.css';
import './idle.css';

import * as realApi from '../shared/api';
import { GameError, toGameError } from '../shared/errors';
import type { BolsaEstado, IdleBoardRow, IdleState, IdleVisual } from '../shared/types';
import { ativos } from './ativos';
import { criarAudio } from './audio';
import { quantasCompradas, sonsDaMudanca } from './audio/eventos';
import { buscarBolsaAgora, faltaVirar, proximaBusca, RECARREGA_BOLSA } from './bolsa';
import { avisos, criarFilaAvisos, detectarNovas } from './legado';
import { temNovidade } from './novidades';
import { aoVivo, instante, pendentes } from './oportunidades';
import { carregarImagem, carregarKit, criarDesenhista, type Desenhar } from './navegador';
import { criarPalco } from './palco';
import { PADRAO, sortear } from './personagem';
import { gravarChave, gravarVolumeMusica, lerChave, lerVista, lerVolumeMusica, marcarVista, type ChaveSom } from './preferencias';
import {
  agoraServidor, ancorar, caixa, cenaDoEstado, faseDoEstado, inicioSemana, deveAbrirEditor, segundosOportunidade, valuationAgora, vencido, type Ancora, type Fase,
} from './store';
import { criarTela, type Aba, type TelaConfig } from './tela';
import { vigiarVersao } from '../shared/atualizar';

// aba aberta há tempo recarrega sozinha quando sai versão nova (no dev o Vite já recarrega)
if (!import.meta.env.DEV) vigiarVersao();

type Api = Pick<
  typeof realApi,
  'idleOpen' | 'idleStart' | 'idleBuy' | 'idlePickStrategy' | 'idleClaim' | 'idleDouradoPegar' | 'idleBoard' | 'idleHire' | 'idleSetAvatar' | 'idlePrestige' | 'idleBuyNode' | 'idleBolsa' | 'idleBolsaNegociar' | 'idleBolsaMelhorar' | 'hasSession'
>;
// só no dev: ?mock joga contra as migrações rodando no navegador (dev/mockIdle.ts)
const api: Api = import.meta.env.DEV && new URLSearchParams(location.search).has('mock') ? await import('../dev/mockIdle') : realApi;

const RECARREGA = [
  'idle_cant_afford', 'idle_locked', 'idle_owned', 'idle_strategy_set', 'idle_strategy_pending', 'idle_opp_gone', 'idle_opp_cap',
  'idle_not_started', 'idle_started', 'idle_hire_twice', 'idle_hire_not_open', 'idle_prestige_low', 'idle_points_low',
  'idle_node_owned', 'idle_dourado_pego',
];
// contratar recusado: o placar (quem já trabalha pra quem) também ficou velho
const RECARREGA_PLACAR = ['idle_hire_twice', 'idle_hire_not_open'];

let fase: Fase = 'carregando';
let ancora: Ancora | null = null;
let aba: Aba = 'loja';
let placar: IdleBoardRow[] | null = null;
let placarFalhou = false;
let aviso: string | null = null;
let ocupado = false;
let caixaAberta = false;
// configurações: a folha, o som e a bolinha de patch note não lida (tudo no aparelho)
let config: TelaConfig = 'fechada';
let chaves: Record<ChaveSom, boolean> = { efeitos: lerChave('efeitos'), avisos: lerChave('avisos') };
let volumeMusica = lerVolumeMusica();
// o som: liga no 1º toque; a música segue a era (0 = antes do Abrir CNPJ)
const audio = criarAudio();
audio.chaves({ musica: volumeMusica, efeitos: chaves.efeitos });
let vivoSoou: number | null = null;
let novidadeNova = temNovidade(lerVista());
let vivoAtual: number | null = null;
// editor de personagem: rascunho aberto (null = fechado). Fechar sem salvar mostra o fundador padrão; o editor só
// volta sozinho na próxima abertura da página, até o primeiro "Bora".
let rascunho: IdleVisual | null = null;
let editorFechado = false;
// bonecos soltos (cartas, placar, editor) só desenham depois que o kit carrega
let desenhar: Desenhar = () => undefined;
// o vencimento de contrato que já pediu um "bater o ponto" (pede uma vez por vencimento)
let vencimentoPedido: string | null = null;
// folha "Vender a startup?" aberta; aviso de conquista na cena (um de cada vez, 3 s cada)
let vendaAberta = false;
let conquistaAviso: string | null = null;
// as conquistas que a página já conhecia (null = ainda não carregou): avisa só as que aparecem depois
let conquistasConhecidas: number[] | null = null;
// Bolsa: gaveta aberta e o último mercado buscado; um temporizador busca de novo na virada do minuto enquanto aberta
let bolsaAberta = false;
let bolsa: BolsaEstado | null = null;
let bolsaBuscadaEm = 0; // quando o mercado chegou (o "preço novo em" desce a partir daí)
let timerBolsa: ReturnType<typeof setTimeout> | null = null;
let buscandoBolsa = false;
// ações que viraram pó desde que a gaveta abriu (o servidor avisa uma vez só; o aviso fica na Bolsa até fechar)
let poPendentes: BolsaEstado['viraram_po'] = [];
/** Guarda o mercado que chegou (busca, compra/venda ou melhoria) e os avisos de pó dele. */
function receberBolsa(b: BolsaEstado) {
  bolsa = b;
  bolsaBuscadaEm = Date.now();
  poPendentes = [...poPendentes, ...b.viraram_po];
  if (b.viraram_po.length) audio.tocar('po');
}

async function carregarBolsa() {
  if (timerBolsa !== null) clearTimeout(timerBolsa);
  timerBolsa = null;
  const s = ancora?.estado;
  if (!bolsaAberta || !s || (s.generators[18] ?? 0) < 1) return; // gerador 19 = Grupo de trader
  buscandoBolsa = true;
  try {
    receberBolsa(await api.idleBolsa());
    render();
  } catch {
    // sem rede: tenta de novo na próxima virada
  }
  buscandoBolsa = false;
  if (bolsaAberta && !document.hidden) timerBolsa = setTimeout(() => void carregarBolsa(), proximaBusca(bolsa?.vira_em_ms ?? 60_000));
}
// avisos desligados: sem o aviso de conquista e sem o som dele
const filaAvisos = criarFilaAvisos((texto) => {
  conquistaAviso = chaves.avisos ? texto : null;
  if (texto && chaves.avisos) audio.tocar('conquista');
  render();
});

const tela = criarTela(document.getElementById('app')!, {
  abrirCnpj: () => void guard(abrirCnpj),
  comprar: (tipo, id, qtd) => void guard(async () => {
    const antes = ancora?.estado ?? null;
    const s = await api.idleBuy(tipo, id, qtd);
    aplicar(s);
    const n = quantasCompradas(antes, s, tipo, id);
    audio.tocar(n > 1 ? 'compraMuitas' : 'compra', { quantas: n });
  }),
  escolher: (era, opcao) => void guard(async () => aplicar(await api.idlePickStrategy(era, opcao))),
  pegar: (w) => void guard(async () => {
    aplicar(await api.idleClaim(w));
    audio.tocar('pegar');
  }),
  trocarAba: (nova) => {
    aba = nova;
    if (nova === 'placar' || nova === 'gente') void carregarPlacar();
    if (nova === 'gente') void prepararDesenhista();
    render();
  },
  caixa: (aberta) => { caixaAberta = aberta; render(); },
  config: (acao) => {
    config = acao === 'abrir' ? 'menu' : acao;
    if (config === 'notas') {
      marcarVista();
      novidadeNova = false;
    }
    render();
  },
  chave: (qual, ligada) => {
    chaves = { ...chaves, [qual]: ligada };
    gravarChave(qual, ligada);
    audio.chaves({ musica: volumeMusica, efeitos: chaves.efeitos });
    if (qual === 'avisos' && !ligada) conquistaAviso = null; // some na hora
    render();
  },
  efeito: (id) => audio.tocar(id),
  // arrastando a barra: só o som muda (sem render: a barra fica na mão)
  volumeMusica: (v) => {
    volumeMusica = v;
    gravarVolumeMusica(v);
    audio.chaves({ musica: v, efeitos: chaves.efeitos });
  },
  tentarDeNovo: () => {
    if (placar === null) void carregarPlacar();
    void guard(recarregar);
  },
  contratar: (uid) => void guard(async () => {
    aplicar(await api.idleHire(uid));
    await carregarPlacar();
  }),
  editor: (acao) => {
    if (acao === 'salvar') {
      const v = rascunho;
      if (v) void guard(() => salvarVisual(v));
      return;
    }
    if (acao === 'abrir') {
      rascunho = { ...(ancora?.estado.avatar ?? PADRAO) };
      void prepararDesenhista();
    } else if (acao === 'fechar') {
      rascunho = null;
      editorFechado = true;
    } else rascunho = sortear();
    render();
  },
  mudarVisual: (campo, valor) => {
    if (!rascunho) return;
    rascunho = { ...rascunho, [campo]: valor };
    render();
  },
  vender: (acao) => {
    if (acao === 'confirmar') {
      vendaAberta = false; // fecha já: deu certo, a cena volta pro "antes"; deu errado, o aviso diz por quê
      void guard(async () => {
        aplicar(await api.idlePrestige());
        audio.tocar('venda');
        aba = 'loja'; // quando reabrir a empresa, começa comprando
        bolsaAberta = false; // a empresa nova não tem trader: a Bolsa fecha
        await carregarPlacar();
      });
      return;
    }
    vendaAberta = acao === 'abrir';
    render();
  },
  comprarNo: (id) => void guard(async () => {
    aplicar(await api.idleBuyNode(id));
    audio.tocar('no');
  }),
  bolsa: (acao) => {
    bolsaAberta = acao === 'abrir';
    if (!bolsaAberta) poPendentes = [];
    if (!bolsaAberta && timerBolsa !== null) clearTimeout(timerBolsa);
    render();
    if (bolsaAberta) void carregarBolsa();
  },
  negociar: (empresa, lado, qtd, tick) => void guard(async () => {
    const p = bolsa?.carteira.find((x) => x.empresa === empresa);
    const m = bolsa?.empresas.find((x) => x.id === empresa);
    const lucro = !p || !m || m.valor >= p.custo / p.qtd;
    const r = await api.idleBolsaNegociar(empresa, lado, qtd, tick);
    receberBolsa(r.bolsa);
    aplicar(r);
    audio.tocar(lado === 'comprar' ? 'acaoCompra' : 'acaoVende', { lucro });
  }),
  melhorar: (tipo, nivel) => void guard(async () => {
    const r = await api.idleBolsaMelhorar(tipo, nivel);
    receberBolsa(r.bolsa);
    aplicar(r);
    audio.tocar('compra');
  }),
}, (canvas, v, opcoes) => desenhar(canvas, v, opcoes));
// o palco recebe o kit como função (tenta de novo quando falha); o editor e as cartas esperam o mesmo kit
const palco = criarPalco(tela.canvas, ativos.camadas, carregarKit);
// bonecos soltos: se o kit falhar, tenta de novo (30 s, ao voltar pra aba, ao abrir Contratar/editor) e recria o desenhista
let desenhistaPronto = false;
let desenhistaCarregando = false;
let cadeiraImg: Awaited<ReturnType<typeof carregarImagem>> | null | undefined;
async function prepararDesenhista() {
  if (desenhistaPronto || desenhistaCarregando) return;
  desenhistaCarregando = true;
  try {
    const k = await carregarKit(); // null = a arte ainda não existe (não é falha)
    let cadeiraFalhou = false;
    if (cadeiraImg === undefined) {
      const url = ativos.cadeira();
      if (!url) cadeiraImg = null;
      else {
        cadeiraImg = await carregarImagem(url).catch((e) => {
          console.warn(`Fellas Inc.: a cadeira do editor não carregou (${url})`, e);
          cadeiraFalhou = true;
          return undefined; // não guarda: a próxima chamada tenta de novo
        });
      }
    }
    desenhar = criarDesenhista(k, cadeiraImg ?? null);
    if (cadeiraFalhou) throw new Error('cadeira'); // desenha sem cadeira por enquanto e tenta de novo
    desenhistaPronto = true;
    render();
  } catch {
    // o kit já avisou no console; os bonecos ficam vazios até a próxima tentativa
    setTimeout(() => void prepararDesenhista(), 30_000);
  } finally {
    desenhistaCarregando = false;
  }
}
void prepararDesenhista();

function agoraSrv() {
  return ancora ? agoraServidor(ancora, Date.now()) : Date.now();
}

/** A oportunidade passando agora, só se o banco ainda aceita: não pega e não é de antes do início da semana. */
function vivoAgora(s: IdleState, agora: number): number | null {
  if (fase !== 'jogando' || s.opp_left <= 0) return null;
  const w = aoVivo(s.user_id, agora, segundosOportunidade(s, s.bonus.arvore));
  if (w === null || s.opp_claimed.map(Number).includes(w) || instante(s.user_id, w) < inicioSemana(s)) return null;
  return w;
}

function render() {
  const s = ancora?.estado ?? null;
  const agora = agoraSrv();
  const lista = s ? pendentes(s.user_id, agora, s.opp_claimed.map(Number), inicioSemana(s), caixa(s)) : [];
  vivoAtual = s ? vivoAgora(s, agora) : null;
  tela.renderizar({
    fase, estado: s, aba, placar, aviso, ocupado, caixaAberta, editor: rascunho, placarFalhou, config, chaves, volumeMusica, novidadeNova,
    pendentes: s ? lista.slice(0, Math.max(0, s.opp_left)) : [], aoVivo: vivoAtual, vendaAberta, conquistaAviso, bolsaAberta,
    bolsa: bolsa && { ...bolsa, vira_em_ms: faltaVirar(bolsa.vira_em_ms, bolsaBuscadaEm, Date.now()), viraram_po: poPendentes },
  });
  if (ancora) tela.atualizarValor(valuationAgora(ancora, Date.now()));
}

function aplicar(estado: IdleState) {
  const antes = ancora?.estado ?? null;
  ancora = ancorar(estado, Date.now());
  fase = faseDoEstado(estado, fase);
  palco.gente({ dono: estado.avatar ?? PADRAO, equipe: estado.equipe.map((c) => c.avatar ?? PADRAO) });
  if (fase === 'antes') palco.preparar(['cena-0-abrindo', 'cena-1']);
  // nunca salvou o visual: o editor aparece sozinho (antes do Abrir CNPJ ou já jogando), até o primeiro "Bora"
  if (deveAbrirEditor(estado, fase, editorFechado, rascunho !== null)) rascunho = { ...PADRAO };
  if (fase !== 'abrindo') palco.tocar(cenaDoEstado(estado, fase));
  render();
  for (const id of sonsDaMudanca(antes, estado)) audio.tocar(id);
  audio.era(fase === 'antes' ? 0 : estado.era);
  // avisa as novas da chamada e as que apareceram sem estar nelas (ser contratado, "Pai tá on"); a 1ª carga não avisa o histórico
  const novas = detectarNovas(conquistasConhecidas, estado);
  conquistasConhecidas = novas.conhecidas;
  filaAvisos.adicionar(avisos(novas.ids));
  // o 1º Grupo de trader (ou o de depois de vender a startup) chegou com a gaveta aberta: nada estava marcado, busca já
  if (buscarBolsaAgora(bolsaAberta, (estado.generators[18] ?? 0) >= 1, timerBolsa !== null || buscandoBolsa)) void carregarBolsa();
}

async function recarregar() {
  aplicar(await api.idleOpen());
}

async function salvarVisual(v: IdleVisual) {
  aplicar(await api.idleSetAvatar(v));
  rascunho = null;
  if (aba === 'placar' || aba === 'gente') await carregarPlacar();
}

async function abrirCnpj() {
  const estado = await api.idleStart();
  audio.tocar('cnpj');
  fase = 'abrindo';
  aplicar(estado);
  palco.tocar('cena-0-abrindo', {
    umaVez: true,
    aoTerminar: () => {
      fase = 'jogando';
      palco.tocar(cenaDoEstado(ancora!.estado, fase));
      render();
    },
  });
}

const ERRO_PLACAR = 'Não deu pra carregar o placar. Tenta de novo.';

/** Erro mantém o placar anterior (null = "Carregando…") e avisa; acertar depois limpa esse aviso. */
async function carregarPlacar() {
  try {
    placar = await api.idleBoard();
    placarFalhou = false;
    if (aviso === ERRO_PLACAR) aviso = null;
  } catch {
    placarFalhou = placar === null;
    aviso = ERRO_PLACAR;
  }
  render();
}

/** Uma ação por vez; erro vira aviso; se o banco disse que o estado mudou, recarrega. */
async function guard(trabalho: () => Promise<void>) {
  if (ocupado) return;
  ocupado = true;
  aviso = null;
  render();
  try {
    await trabalho();
  } catch (e) {
    const err = toGameError(e);
    if (err.code === 'no_session') {
      fase = 'sem_sessao';
      filaAvisos.parar();
    }
    else {
      audio.tocar('erro');
      aviso = err.message;
      if (RECARREGA.includes(err.code)) await recarregar().catch(() => undefined);
      if (RECARREGA_PLACAR.includes(err.code)) await carregarPlacar();
      if (RECARREGA_BOLSA.includes(err.code)) await carregarBolsa();
    }
  } finally {
    ocupado = false;
    render();
  }
}

// número subindo e a oportunidade ao vivo (só com a aba visível)
setInterval(() => {
  if (document.hidden || !ancora) return;
  tela.atualizarValor(valuationAgora(ancora, Date.now()));
  if (bolsaAberta && bolsa) tela.relogioBolsa(faltaVirar(bolsa.vira_em_ms, bolsaBuscadaEm, Date.now()));
  const vivo = vivoAgora(ancora.estado, agoraSrv());
  if (vivo !== null && vivo !== vivoSoou) {
    vivoSoou = vivo;
    audio.tocar('oportunidade');
  }
  if (vivo !== vivoAtual) render();
  // um contrato venceu: a taxa mudou no banco, bate o ponto (uma vez por vencimento)
  const s = ancora.estado;
  if (vencido(s, agoraSrv()) && vencimentoPedido !== s.muda_em && !ocupado) {
    vencimentoPedido = s.muda_em;
    void guard(recarregar);
  }
}, 100);
setInterval(() => { if (!document.hidden && (aba === 'placar' || aba === 'gente')) void carregarPlacar(); }, 60_000);

// voltou pra aba: bate o ponto de novo (foto de segunda, contrato vencido)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void prepararDesenhista();
  if (!document.hidden && bolsaAberta) void carregarBolsa();
  if (!document.hidden && fase !== 'carregando' && fase !== 'sem_sessao' && fase !== 'abrindo') void guard(recarregar);
});

void (async () => {
  if (import.meta.env.DEV && api.idleOpen === realApi.idleOpen) {
    const { devLogin } = await import('../shared/devLogin');
    await devLogin();
  }
  await document.fonts.ready;
  if (!(await api.hasSession())) {
    fase = 'sem_sessao';
    filaAvisos.parar();
    render();
    return;
  }
  await guard(recarregar);
  if (fase === 'carregando') tela.fatal(new GameError('unknown').message);
})();
