// Fellas Inc.: liga banco, tela e palco. O banco decide tudo; aqui só se pede, se mostra e se anima o número.
import '../shared/hud/hud.css';
import './idle.css';

import * as realApi from '../shared/api';
import { GameError, toGameError } from '../shared/errors';
import type { IdleBoardRow, IdleState } from '../shared/types';
import { ativos } from './ativos';
import { aoVivo, instante, pendentes } from './oportunidades';
import { carregarKit } from './navegador';
import { criarPalco } from './palco';
import {
  agoraServidor, ancorar, cenaDoEstado, faseDoEstado, inicioSemana, segundosOportunidade, valuationAgora, type Ancora, type Fase,
} from './store';
import { criarTela, type Aba } from './tela';
import { vigiarVersao } from '../shared/atualizar';

// aba aberta há tempo recarrega sozinha quando sai versão nova (no dev o Vite já recarrega)
if (!import.meta.env.DEV) vigiarVersao();

type Api = Pick<typeof realApi, 'idleOpen' | 'idleStart' | 'idleBuy' | 'idlePickStrategy' | 'idleClaim' | 'idleBoard' | 'hasSession'>;
// só no dev: ?mock joga contra as migrações rodando no navegador (dev/mockIdle.ts)
const api: Api = import.meta.env.DEV && new URLSearchParams(location.search).has('mock') ? await import('../dev/mockIdle') : realApi;

const RECARREGA = ['idle_cant_afford', 'idle_locked', 'idle_owned', 'idle_strategy_set', 'idle_strategy_pending', 'idle_opp_gone', 'idle_opp_cap', 'idle_not_started', 'idle_started'];

let fase: Fase = 'carregando';
let ancora: Ancora | null = null;
let aba: Aba = 'geradores';
let placar: IdleBoardRow[] | null = null;
let aviso: string | null = null;
let ocupado = false;
let caixaAberta = false;
let vivoAtual: number | null = null;

const tela = criarTela(document.getElementById('app')!, {
  abrirCnpj: () => void guard(abrirCnpj),
  comprar: (tipo, id, qtd) => void guard(async () => aplicar(await api.idleBuy(tipo, id, qtd))),
  escolher: (era, opcao) => void guard(async () => aplicar(await api.idlePickStrategy(era, opcao))),
  pegar: (w) => void guard(async () => aplicar(await api.idleClaim(w))),
  trocarAba: (nova) => { aba = nova; if (nova === 'placar') void carregarPlacar(); render(); },
  caixa: (aberta) => { caixaAberta = aberta; render(); },
  tentarDeNovo: () => void guard(recarregar),
});
const palco = criarPalco(tela.canvas, ativos.camadas, carregarKit);

function agoraSrv() {
  return ancora ? agoraServidor(ancora, Date.now()) : Date.now();
}

/** A oportunidade passando agora, só se o banco ainda aceita: não pega e não é de antes do início da semana. */
function vivoAgora(s: IdleState, agora: number): number | null {
  if (fase !== 'jogando' || s.opp_left <= 0) return null;
  const w = aoVivo(s.user_id, agora, segundosOportunidade(s));
  if (w === null || s.opp_claimed.map(Number).includes(w) || instante(s.user_id, w) < inicioSemana(s)) return null;
  return w;
}

function render() {
  const s = ancora?.estado ?? null;
  const agora = agoraSrv();
  const lista = s ? pendentes(s.user_id, agora, s.opp_claimed.map(Number), inicioSemana(s)) : [];
  vivoAtual = s ? vivoAgora(s, agora) : null;
  tela.renderizar({ fase, estado: s, aba, placar, aviso, ocupado, caixaAberta, pendentes: s ? lista.slice(0, Math.max(0, s.opp_left)) : [], aoVivo: vivoAtual });
  if (ancora) tela.atualizarValor(valuationAgora(ancora, Date.now()));
}

function aplicar(estado: IdleState) {
  ancora = ancorar(estado, Date.now());
  fase = faseDoEstado(estado, fase);
  if (fase !== 'abrindo') palco.tocar(cenaDoEstado(estado, fase));
  render();
}

async function recarregar() {
  aplicar(await api.idleOpen());
}

async function abrirCnpj() {
  const estado = await api.idleStart();
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
    if (aviso === ERRO_PLACAR) aviso = null;
  } catch {
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
    if (err.code === 'no_session') fase = 'sem_sessao';
    else {
      aviso = err.message;
      if (RECARREGA.includes(err.code)) await recarregar().catch(() => undefined);
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
  if (vivoAgora(ancora.estado, agoraSrv()) !== vivoAtual) render();
}, 100);
setInterval(() => { if (!document.hidden && aba === 'placar') void carregarPlacar(); }, 60_000);

// voltou pra aba: bate o ponto de novo (pode ter virado a semana)
document.addEventListener('visibilitychange', () => {
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
    render();
    return;
  }
  await guard(recarregar);
  if (fase === 'carregando') tela.fatal(new GameError('unknown').message);
})();
