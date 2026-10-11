// Motor de áudio: o contexto (criado no 1º toque: o navegador não deixa antes), os barramentos música / efeitos /
// geral até o limitador, o fade com a aba e o "abaixa a música" dos momentos grandes.
export const VOL_MUSICA = 0.22; // medido na página de audição: a música fica uns 10 dB abaixo dos efeitos principais
export const VOL_EFEITOS = 0.8;
const ABAIXADA = 0.4; // ~−8 dB

export type Saida = { musica: GainNode; efeitos: GainNode; geral: GainNode };

/** A cadeia de saída (também usada no render offline da página de audição). */
export function montarSaida(ctx: BaseAudioContext): Saida {
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -10;
  lim.knee.value = 6;
  lim.ratio.value = 12;
  lim.attack.value = 0.003;
  lim.release.value = 0.25;
  lim.connect(ctx.destination);
  const geral = ctx.createGain();
  geral.gain.value = 0.9;
  geral.connect(lim);
  const musica = ctx.createGain();
  musica.gain.value = VOL_MUSICA;
  musica.connect(geral);
  const efeitos = ctx.createGain();
  efeitos.gain.value = VOL_EFEITOS;
  efeitos.connect(geral);
  return { musica, efeitos, geral };
}

export type Motor = {
  /** Cria (ou retoma) o contexto: só funciona dentro de um toque/tecla. */
  ligar(): void;
  ligado(): boolean;
  ctx(): BaseAudioContext | null;
  saida(): Saida | null;
  /** Volume da música, de 0 (desligada) a 1 (o segue a aba visível). */
  musica(volume: number): void;
  visivel(sim: boolean): void;
  abaixarMusica(segundos: number): void;
};

export function criarMotor(fabrica: () => AudioContext): Motor {
  let ctx: AudioContext | null = null;
  let s: Saida | null = null;
  let volume = 1;
  let aVista = true;
  const alvo = () => (aVista ? VOL_MUSICA * volume : 0);
  const fade = (segundos: number) => {
    if (!ctx || !s) return;
    const g = s.musica.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(alvo(), t, segundos / 3);
  };
  return {
    ligar() {
      if (!ctx) {
        ctx = fabrica();
        s = montarSaida(ctx);
        s.musica.gain.value = 0;
      }
      if (ctx.state !== 'running') void ctx.resume();
      fade(1.5);
    },
    ligado: () => ctx !== null,
    ctx: () => ctx,
    saida: () => s,
    musica(v) {
      volume = Math.max(0, Math.min(1, v));
      fade(0.3);
    },
    visivel(sim) {
      aVista = sim;
      if (!ctx) return;
      const c = ctx;
      if (sim) {
        void c.resume();
        fade(1.5);
      } else {
        fade(0.3);
        setTimeout(() => {
          if (!aVista) void c.suspend();
        }, 350);
      }
    },
    abaixarMusica(segundos) {
      if (!ctx || !s || alvo() === 0) return;
      const g = s.musica.gain;
      const t = ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(VOL_MUSICA * ABAIXADA, t, 0.05);
      g.setTargetAtTime(alvo(), t + segundos, 0.3);
    },
  };
}
