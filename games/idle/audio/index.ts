// O som da Fellas Inc. pro resto do jogo: liga no 1º toque (e retoma se o sistema suspendeu), segue as chaves, a aba
// e a era, e toca os efeitos.
import { criarLimite, GRANDES, RECEITAS, type IdEfeito, type OpcoesEfeito } from './efeitos';
import { criarMotor } from './motor';
import { criarSequenciador } from './sequenciador';

export type { IdEfeito, OpcoesEfeito } from './efeitos';
/** `musica` = volume de 0 (desligada) a 1. */
export type ChavesSom = { musica: number; efeitos: boolean };
export type Audio = {
  tocar(id: IdEfeito, o?: OpcoesEfeito): void;
  /** Era da música (0 = antes do Abrir CNPJ); troca no fim do giro. */
  era(era: number): void;
  chaves(c: ChavesSom): void;
};

export function criarAudio(fabrica: () => AudioContext = () => new AudioContext(), alvo: Document = document): Audio {
  const motor = criarMotor(fabrica);
  const seq = criarSequenciador({ ctx: motor.ctx, destino: () => motor.saida()?.musica ?? null });
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
