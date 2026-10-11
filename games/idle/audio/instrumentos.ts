// Os instrumentos da música e dos efeitos, sintetizados na hora (sem arquivo): osciladores, ruído filtrado e
// envelopes. Cada um agenda uma nota em `t` (segundos do contexto) e se desliga sozinho.
import type { Instrumento } from './musica';

export type Toque = (ctx: BaseAudioContext, destino: AudioNode, t: number, altura: number, dur: number, forca: number) => void;
export const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

const ruidos = new WeakMap<BaseAudioContext, AudioBuffer>();
/** 1 s de ruído branco (sempre o mesmo), guardado por contexto. */
export function ruido(ctx: BaseAudioContext): AudioBuffer {
  let b = ruidos.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 1;
    for (let i = 0; i < d.length; i++) {
      s = (s * 16807) % 2147483647;
      d[i] = (s / 2147483647) * 2 - 1;
    }
    ruidos.set(ctx, b);
  }
  return b;
}

/** Ganho com ataque e queda exponencial até quase zero em `dura` segundos. */
function envelope(ctx: BaseAudioContext, destino: AudioNode | AudioParam, t: number, pico: number, ataque: number, dura: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(pico, 0.0002), t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dura, ataque + 0.01));
  g.connect(destino as AudioNode);
  return g;
}
function osc(ctx: BaseAudioContext, tipo: OscillatorType, f: number, destino: AudioNode | AudioParam, t: number, fim: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  o.connect(destino as AudioNode);
  o.start(t);
  o.stop(fim + 0.05);
  return o;
}
function ruidoEm(ctx: BaseAudioContext, destino: AudioNode, t: number, fim: number) {
  const s = ctx.createBufferSource();
  s.buffer = ruido(ctx);
  s.loop = true;
  s.connect(destino);
  s.start(t);
  s.stop(fim + 0.05);
}
function filtro(ctx: BaseAudioContext, tipo: BiquadFilterType, f: number, q: number, destino: AudioNode): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = tipo;
  b.frequency.value = f;
  b.Q.value = q;
  b.connect(destino);
  return b;
}

/** Baixo acústico: triângulo filtrado + seno, ataque de dedo. */
const baixo: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + Math.min(dur, 1.2) + 0.12;
  const g = envelope(ctx, d, t, 0.45 * f, 0.008, fim - t);
  osc(ctx, 'triangle', hz(m), filtro(ctx, 'lowpass', 800, 0.7, g), t, fim);
  osc(ctx, 'sine', hz(m), g, t, fim);
};
/** Piano elétrico: FM (o brilho do ataque cai rápido). */
const piano: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + dur + 0.5;
  const g = envelope(ctx, d, t, 0.13 * f, 0.004, fim - t);
  const portadora = osc(ctx, 'sine', hz(m), g, t, fim);
  const indice = ctx.createGain();
  indice.gain.setValueAtTime(hz(m) * 2.2, t);
  indice.gain.exponentialRampToValueAtTime(hz(m) * 0.2, t + 0.35);
  indice.connect(portadora.frequency);
  osc(ctx, 'sine', hz(m), indice, t, fim);
};
/** Vibrafone: seno com o parcial 4× no ataque e o tremolo do motorzinho. */
const vibrafone: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + dur + 0.9;
  const trem = ctx.createGain();
  trem.gain.setValueAtTime(1, t);
  trem.connect(d);
  const lfo = ctx.createGain();
  lfo.gain.setValueAtTime(0.22, t);
  lfo.connect(trem.gain);
  osc(ctx, 'sine', 5.5, lfo, t, fim);
  osc(ctx, 'sine', hz(m), envelope(ctx, trem, t, 0.2 * f, 0.003, fim - t), t, fim);
  osc(ctx, 'sine', hz(m) * 4, envelope(ctx, trem, t, 0.05 * f, 0.002, 0.25), t, t + 0.25);
};
/** Metais: dois dentes de serra desafinados, o filtro abre no ataque. */
const metais: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + dur + 0.15;
  const g = envelope(ctx, d, t, 0.09 * f, 0.03, fim - t);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2;
  lp.frequency.setValueAtTime(500, t);
  lp.frequency.linearRampToValueAtTime(2600, t + 0.05);
  lp.frequency.exponentialRampToValueAtTime(900, fim);
  lp.connect(g);
  for (const det of [-7, 7]) osc(ctx, 'sawtooth', hz(m), lp, t, fim).detune.setValueAtTime(det, t);
};
const escovinha: Toque = (ctx, d, t, _m, _dur, f) => {
  ruidoEm(ctx, filtro(ctx, 'bandpass', 3500, 0.6, envelope(ctx, d, t, 0.1 * f, 0.025, 0.22)), t, t + 0.25);
};
const conducao: Toque = (ctx, d, t, _m, _dur, f) => {
  ruidoEm(ctx, filtro(ctx, 'highpass', 6500, 0.5, envelope(ctx, d, t, 0.05 * f, 0.002, 0.5)), t, t + 0.5);
  osc(ctx, 'triangle', 3150, envelope(ctx, d, t, 0.015 * f, 0.002, 0.35), t, t + 0.35);
};
const bumbo: Toque = (ctx, d, t, _m, _dur, f) => {
  osc(ctx, 'sine', 115, envelope(ctx, d, t, 0.5 * f, 0.003, 0.3), t, t + 0.3).frequency.exponentialRampToValueAtTime(45, t + 0.12);
};
const caixa: Toque = (ctx, d, t, _m, _dur, f) => {
  ruidoEm(ctx, filtro(ctx, 'bandpass', 1800, 0.8, envelope(ctx, d, t, 0.22 * f, 0.002, 0.15)), t, t + 0.16);
  osc(ctx, 'triangle', 190, envelope(ctx, d, t, 0.08 * f, 0.002, 0.1), t, t + 0.1);
};
/** Só dos efeitos: sininho (sino com o parcial 2,76). */
const sininho: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + dur + 0.5;
  osc(ctx, 'sine', hz(m), envelope(ctx, d, t, 0.16 * f, 0.002, fim - t), t, fim);
  osc(ctx, 'sine', hz(m) * 2.76, envelope(ctx, d, t, 0.05 * f, 0.002, (fim - t) * 0.5), t, fim);
};
/** Só dos efeitos: moedinha de videogame (sobe uma quarta no meio). */
const moeda: Toque = (ctx, d, t, m, _dur, f) => {
  const o = osc(ctx, 'square', hz(m), filtro(ctx, 'lowpass', 3500, 0.7, envelope(ctx, d, t, 0.16 * f, 0.002, 0.28)), t, t + 0.28);
  o.frequency.setValueAtTime(hz(m + 5), t + 0.06);
};

export const INSTRUMENTOS: Record<Instrumento | 'sininho' | 'moeda', Toque> = {
  baixo, piano, vibrafone, metais, escovinha, conducao, bumbo, caixa, sininho, moeda,
};
