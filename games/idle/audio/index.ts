// O som da Fellas Inc. pro resto do jogo: tenta ligar já na criação e de novo quando a aba volta (aba restaurada pelo
// navegador também soa, se ele deixar; se não, o 1º toque liga), retoma se o sistema suspendeu, recria o contexto
// fechado ou travado, segue as chaves, a aba e a era, e toca os efeitos.
import { criarLimite, GRANDES, RECEITAS, type IdEfeito, type OpcoesEfeito } from './efeitos';
import { criarMotor } from './motor';
import { ADIANTE_S, criarSequenciador } from './sequenciador';

export type { IdEfeito, OpcoesEfeito } from './efeitos';
/** `musica` = volume de 0 (desligada) a 1. */
export type ChavesSom = { musica: number; efeitos: boolean };
export type Audio = {
  tocar(id: IdEfeito, o?: OpcoesEfeito): void;
  /** Era da música (0 = antes do Abrir CNPJ); troca no fim do giro. */
  era(era: number): void;
  chaves(c: ChavesSom): void;
  /** Agenda o efeito pra daqui a `atrasoS` no relógio do áudio (aba escondida no PC: o navegador quase não acorda a página). */
  tocarEm(id: IdEfeito, atrasoS: number, o?: OpcoesEfeito): void;
  /** Cancela os agendados que ainda não tocaram (a aba voltou: a página toca na hora). */
  cancelarAgendados(): void;
};

/** No PC a música segue com a aba escondida; no celular (toque como forma principal) pausa, como a maioria dos jogos. */
const SEGUNDO_PLANO = typeof matchMedia === 'function' ? !matchMedia('(pointer: coarse)').matches : true;
const GIRO_A_FRENTE_S = 70; // um giro inteiro (53–64 s) e um pouco: a aba escondida pode acordar só 1 vez por minuto

export function criarAudio(
  fabrica: () => AudioContext = () => new AudioContext(), alvo: Document = document,
  opcoes: {
    segundoPlano?: boolean;
    /** Onde escutar `focus` e `pageshow` (padrão: a janela do documento). */
    janela?: Pick<EventTarget, 'addEventListener'> | null;
    /** Relógio de parede em ms (padrão: performance.now). */
    agora?: () => number;
  } = {},
): Audio {
  const segundoPlano = opcoes.segundoPlano ?? SEGUNDO_PLANO;
  const janela = opcoes.janela === undefined ? alvo.defaultView : opcoes.janela;
  const agora = opcoes.agora ?? (() => performance.now());
  const motor = criarMotor(fabrica, { segundoPlano });
  const seq = criarSequenciador(
    { ctx: motor.ctx, destino: () => motor.saida()?.musica ?? null },
    { adiante: () => (segundoPlano && alvo.hidden ? GIRO_A_FRENTE_S : ADIANTE_S) },
  );
  const limite = criarLimite();
  let chaves: ChavesSom = { musica: 1, efeitos: true };
  let eraAtual: number | null = null; // a música espera o jogo dizer a era (não começa na 0 pra quem já está na 7)
  let agendados: GainNode | null = null; // canal dos agendados: cancelar desliga ele
  const ajustarMusica = () => {
    motor.musica(chaves.musica);
    if (chaves.musica <= 0) seq.parar();
    else if (eraAtual !== null && motor.ligado() && !alvo.hidden) seq.tocar(eraAtual);
  };
  const ligar = () => {
    if (!segundoPlano && alvo.hidden) return; // celular com a aba escondida: fica quieto até ela aparecer
    motor.ligar();
    ajustarMusica();
  };
  // o contexto fechou ou travou: o motor largou ele, e a música e os agendados eram dele
  const conferir = () => {
    if (!motor.conferir(agora())) return;
    seq.parar();
    agendados = null;
    ligar();
  };
  // fora de um toque o navegador pode não deixar: o contexto fica suspenso e o próximo toque retoma
  const acordar = () => {
    conferir();
    if (motor.ctx()?.state !== 'running') ligar();
  };
  // no toque de tela o navegador só conta como gesto o fim do toque (pointerup/touchend/click); o pointerdown vale no mouse
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) alvo.addEventListener(ev, acordar);
  alvo.addEventListener('visibilitychange', () => {
    motor.visivel(!alvo.hidden);
    if (!alvo.hidden) {
      acordar();
      ajustarMusica();
    } else if (segundoPlano) seq.passo(); // já agenda o giro à frente, antes do navegador frear a aba
  });
  janela?.addEventListener('focus', acordar);
  janela?.addEventListener('pageshow', acordar); // voltou do cache de ida e volta do navegador
  acordar();
  return {
    tocar(id, o = {}) {
      conferir();
      const ctx = motor.ctx();
      const s = motor.saida();
      if (!chaves.efeitos || !ctx || !s || ctx.state !== 'running') return;
      if (!limite(id, performance.now())) return;
      const dura = RECEITAS[id](ctx, s.efeitos, ctx.currentTime + 0.01, o);
      if (GRANDES.has(id)) motor.abaixarMusica(dura);
    },
    era(e) {
      const primeira = eraAtual === null;
      eraAtual = e;
      seq.mudarEra(e);
      if (primeira) ajustarMusica();
    },
    tocarEm(id, atrasoS, o = {}) {
      conferir();
      const ctx = motor.ctx();
      const s = motor.saida();
      if (!chaves.efeitos || !ctx || !s || ctx.state !== 'running') return;
      if (!agendados) {
        agendados = ctx.createGain();
        agendados.connect(s.efeitos);
      }
      RECEITAS[id](ctx, agendados, ctx.currentTime + Math.max(0, atrasoS), o);
    },
    cancelarAgendados() {
      agendados?.disconnect();
      agendados = null;
    },
    chaves(c) {
      chaves = c;
      ajustarMusica();
    },
  };
}
