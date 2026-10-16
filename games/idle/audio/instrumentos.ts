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

/** Envelope lento (órgão, pad, grave, ar): sobe em `ataque`, segura até o fim da nota e solta em `soltura`. */
function envelopeLento(ctx: BaseAudioContext, destino: AudioNode, t: number, pico: number, ataque: number, dur: number, soltura: number): GainNode {
  const fimNota = t + Math.max(ataque, dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(pico, 0.0002), t + ataque);
  g.gain.setValueAtTime(Math.max(pico, 0.0002), fimNota);
  g.gain.exponentialRampToValueAtTime(0.0001, fimNota + soltura);
  g.connect(destino);
  return g;
}

/** As parciais do órgão (índice = harmônico): 8', 4', 2 2/3', 2', 1 3/5', 1 1/3' e 1', como as barras de um órgão. */
export const PARCIAIS_ORGAO = [0, 1, 0.55, 0.32, 0.22, 0.1, 0.12, 0, 0.06] as const;
const ondas = new WeakMap<BaseAudioContext, PeriodicWave>();
function ondaOrgao(ctx: BaseAudioContext): PeriodicWave {
  let w = ondas.get(ctx);
  if (!w) {
    w = ctx.createPeriodicWave(new Float32Array(PARCIAIS_ORGAO.length), Float32Array.from(PARCIAIS_ORGAO));
    ondas.set(ctx, w);
  }
  return w;
}

/** Órgão aditivo (eras 6+): a onda das parciais somadas em duas camadas desafinadas (±4 cents, o "coro"), a oitava de
 *  baixo bem leve, ataque de 0,35 s, soltura de 1,2 s e um vibrato leve (5,2 Hz, 4 cents) que entra depois do ataque. */
const orgao: Toque = (ctx, d, t, m, dur, f) => {
  const ataque = 0.35;
  const soltura = 1.2;
  const fim = t + Math.max(ataque, dur) + soltura;
  const g = envelopeLento(ctx, d, t, 0.05 * f, ataque, dur, soltura);
  const vib = ctx.createGain(); // profundidade do vibrato, em cents
  vib.gain.setValueAtTime(0, t);
  vib.gain.linearRampToValueAtTime(4, t + ataque + 0.4);
  osc(ctx, 'sine', 5.2, vib, t, fim);
  for (const det of [-4, 4]) {
    const o = osc(ctx, 'sine', hz(m), g, t, fim);
    o.setPeriodicWave(ondaOrgao(ctx));
    o.detune.setValueAtTime(det, t);
    vib.connect(o.detune);
  }
  vib.connect(osc(ctx, 'sine', hz(m - 12), envelopeLento(ctx, d, t, 0.02 * f, ataque, dur, soltura), t, fim).detune);
};
/** Pad: dois dentes de serra desafinados (±7 cents) num passa-baixa que abre devagar ao longo da nota; ataque de 1,2 s. */
const pad: Toque = (ctx, d, t, m, dur, f) => {
  const ataque = 1.2;
  const soltura = 1.6;
  const fimNota = t + Math.max(ataque, dur);
  const g = envelopeLento(ctx, d, t, 0.03 * f, ataque, dur, soltura);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.6;
  lp.frequency.setValueAtTime(260, t);
  lp.frequency.exponentialRampToValueAtTime(1800, fimNota);
  lp.connect(g);
  for (const det of [-7, 7]) osc(ctx, 'sawtooth', hz(m), lp, t, fimNota + soltura).detune.setValueAtTime(det, t);
};
/** Arpejo: um "plim" macio (triângulo filtrado e um seno na oitava, só no ataque), cai em 0,7 s. */
const arpejo: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + Math.min(dur, 0.4) + 0.7;
  osc(ctx, 'triangle', hz(m), filtro(ctx, 'lowpass', 2200, 0.5, envelope(ctx, d, t, 0.07 * f, 0.008, fim - t)), t, fim);
  osc(ctx, 'sine', hz(m + 12), envelope(ctx, d, t, 0.015 * f, 0.005, 0.3), t, t + 0.3);
};
/** Grave longo: seno com o triângulo da oitava bem baixinho; ataque de 0,8 s e soltura de 2 s. */
const grave: Toque = (ctx, d, t, m, dur, f) => {
  const ataque = 0.8;
  const soltura = 2;
  const fim = t + Math.max(ataque, dur) + soltura;
  osc(ctx, 'sine', hz(m), envelopeLento(ctx, d, t, 0.28 * f, ataque, dur, soltura), t, fim);
  osc(ctx, 'triangle', hz(m + 12), filtro(ctx, 'lowpass', 400, 0.5, envelopeLento(ctx, d, t, 0.05 * f, ataque, dur, soltura)), t, fim);
};
/** Tique-taque de relógio: estalo seco de ruído passa-alta e um "tic" curto de seno (altura 1 = tique, agudo; 0 = taque). */
const tique: Toque = (ctx, d, t, m, _dur, f) => {
  ruidoEm(ctx, filtro(ctx, 'highpass', 5000, 0.7, envelope(ctx, d, t, 0.06 * f, 0.001, 0.025)), t, t + 0.03);
  osc(ctx, 'sine', m >= 1 ? 2400 : 1700, envelope(ctx, d, t, 0.03 * f, 0.001, 0.04), t, t + 0.04);
};
/** Ar: ruído num passa-banda de 3 kHz, bem baixinho, entra e sai devagar (a sala respirando). */
const ar: Toque = (ctx, d, t, _m, dur, f) => {
  const ataque = Math.min(2, dur / 2);
  const soltura = 2;
  const fim = t + Math.max(ataque, dur) + soltura;
  ruidoEm(ctx, filtro(ctx, 'bandpass', 3000, 0.4, envelopeLento(ctx, d, t, 0.012 * f, ataque, dur, soltura)), t, fim);
};
/** Só dos efeitos: tímpano (seno que assenta na altura, com o baque de ruído grave). */
const timpano: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + Math.max(dur, 0.3) + 0.6;
  const o = osc(ctx, 'sine', hz(m) * 1.02, envelope(ctx, d, t, 0.35 * f, 0.004, fim - t), t, fim);
  o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.15);
  ruidoEm(ctx, filtro(ctx, 'lowpass', 300, 0.7, envelope(ctx, d, t, 0.08 * f, 0.002, 0.12)), t, t + 0.15);
};

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

export const INSTRUMENTOS: Record<Instrumento | 'sininho' | 'moeda' | 'timpano', Toque> = {
  baixo, piano, vibrafone, metais, escovinha, conducao, bumbo, caixa, sininho, moeda,
  orgao, pad, arpejo, grave, tique, ar, timpano,
};
