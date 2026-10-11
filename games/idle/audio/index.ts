// O som da Fellas Inc. pro resto do jogo: liga no 1º toque (e retoma se o sistema suspendeu), segue as chaves, a aba
// e a era, e toca os efeitos.
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
};

/** No PC a música segue com a aba escondida; no celular (toque como forma principal) pausa, como a maioria dos jogos. */
const SEGUNDO_PLANO = typeof matchMedia === 'function' ? !matchMedia('(pointer: coarse)').matches : true;
const GIRO_A_FRENTE_S = 70; // um giro inteiro (53–64 s) e um pouco: a aba escondida pode acordar só 1 vez por minuto

export function criarAudio(
  fabrica: () => AudioContext = () => new AudioContext(), alvo: Document = document, opcoes: { segundoPlano?: boolean } = {},
): Audio {
  const segundoPlano = opcoes.segundoPlano ?? SEGUNDO_PLANO;
  const motor = criarMotor(fabrica, { segundoPlano });
  const seq = criarSequenciador(
    { ctx: motor.ctx, destino: () => motor.saida()?.musica ?? null },
    { adiante: () => (segundoPlano && alvo.hidden ? GIRO_A_FRENTE_S : ADIANTE_S) },
  );
  const limite = criarLimite();
  let chaves: ChavesSom = { musica: 1, efeitos: true };
  let eraAtual = 0;
  const ajustarMusica = () => {
    motor.musica(chaves.musica);
    if (chaves.musica <= 0) seq.parar();
    else if (motor.ligado() && !alvo.hidden) seq.tocar(eraAtual);
  };
  const toque = () => {
    if (motor.ctx()?.state === 'running') return;
    motor.ligar();
    ajustarMusica();
  };
  // no toque de tela o navegador só conta como gesto o fim do toque (pointerup/touchend/click); o pointerdown vale no mouse
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) alvo.addEventListener(ev, toque);
  alvo.addEventListener('visibilitychange', () => {
    motor.visivel(!alvo.hidden);
    if (!alvo.hidden) ajustarMusica();
    else if (segundoPlano) seq.passo(); // já agenda o giro à frente, antes do navegador frear a aba
  });
  return {
    tocar(id, o = {}) {
      const ctx = motor.ctx();
      const s = motor.saida();
      if (!chaves.efeitos || !ctx || !s || ctx.state !== 'running') return;
      if (!limite(id, performance.now())) return;
      const dura = RECEITAS[id](ctx, s.efeitos, ctx.currentTime + 0.01, o);
      if (GRANDES.has(id)) motor.abaixarMusica(dura);
    },
    era(e) {
      eraAtual = e;
      seq.mudarEra(e);
    },
    chaves(c) {
      chaves = c;
      ajustarMusica();
    },
  };
}
