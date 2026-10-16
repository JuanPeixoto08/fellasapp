// A sala da música das eras 6+ (15/10): reverb de convolução com a resposta ao impulso gerada aqui (sem arquivo), pra
// tirar o som "seco" de sintetizador. É um envio: o seco continua igual e o molhado entra por cima; nas eras 0–5 o
// molhado é 0 (o swing de sempre não muda).
import { aleatorio } from './sorte';

export const SALA_S = 3.2;
export const MOLHADO_ESPACO = 0.45;
/** Quanto de sala a música da era tem (era da música, 0 a 7). */
export const molhadoDaEra = (era: number) => (era >= 6 ? MOLHADO_ESPACO : 0);
export type Sala = { entrada: GainNode; molhado(v: number, quando: number): void; desligar(): void };

/** Resposta ao impulso de uma sala grande, em estéreo: 20 ms de pré-atraso, quatro reflexões cedo e a cauda de ruído que
 *  cai 60 dB em `segundos`, cada vez mais escura (passa-baixa de um polo que fecha com o tempo). Pura e com semente. */
export function respostaSala(sr: number, segundos = SALA_S, semente = 20261015): [Float32Array, Float32Array] {
  const n = Math.ceil(sr * segundos);
  const pre = Math.round(0.02 * sr);
  const tau = segundos / 6.91; // e^(−6,91) ≈ −60 dB
  const out: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)];
  out.forEach((d, canal) => {
    const r = aleatorio(semente + canal * 7919);
    let y = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const polo = 0.9 - 0.75 * Math.min(1, t / segundos); // 0,9 no começo (claro), 0,15 no fim (escuro)
      y += polo * (r() * 2 - 1 - y);
      d[i] = y * Math.exp(-t / tau);
    }
    for (const [ms, a] of [[11, 0.5], [17, -0.35], [23, 0.28], [31, -0.2]] as const) {
      const i = pre + Math.round(((ms + canal * 3) / 1000) * sr);
      if (i < n) d[i] += a;
    }
  });
  return out;
}

const respostas = new WeakMap<BaseAudioContext, AudioBuffer>();
function resposta(ctx: BaseAudioContext): AudioBuffer {
  let b = respostas.get(ctx);
  if (!b) {
    const [e, d] = respostaSala(ctx.sampleRate);
    b = ctx.createBuffer(2, e.length, ctx.sampleRate);
    b.getChannelData(0).set(e);
    b.getChannelData(1).set(d);
    respostas.set(ctx, b);
  }
  return b;
}

/** O envio de reverb: o que entra em `entrada` passa pela sala e sai em `destino` com o volume do molhado (começa em 0). */
export function criarSala(ctx: BaseAudioContext, destino: AudioNode): Sala {
  const entrada = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.normalize = true;
  conv.buffer = resposta(ctx);
  const molhado = ctx.createGain();
  molhado.gain.value = 0;
  entrada.connect(conv);
  conv.connect(molhado);
  molhado.connect(destino);
  return {
    entrada,
    molhado(v, quando) {
      molhado.gain.setTargetAtTime(v, quando, 0.5);
    },
    desligar() {
      entrada.disconnect();
      conv.disconnect();
      molhado.disconnect();
    },
  };
}
