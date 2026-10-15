// Áudio de mentira pros testes (o happy-dom não tem Web Audio): grava o que foi criado, agendado e ligado. Só dos
// testes: nada do jogo importa isto.
export class ParamFalso {
  value = 0;
  eventos: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) { this.eventos.push(['set', v, t]); this.value = v; return this; }
  linearRampToValueAtTime(v: number, t: number) { this.eventos.push(['lin', v, t]); this.value = v; return this; }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (v <= 0) throw new RangeError('rampa exponencial até 0');
    this.eventos.push(['exp', v, t]);
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number, t: number) { this.eventos.push(['alvo', v, t]); this.value = v; return this; }
  cancelScheduledValues(t: number) { this.eventos.push(['cancela', 0, t]); return this; }
}
export class NoFalso {
  ligados: unknown[] = [];
  connect<T>(x: T): T { this.ligados.push(x); return x; }
  disconnect() { this.ligados = []; }
}
export class GanhoFalso extends NoFalso {
  gain = new ParamFalso();
  constructor() { super(); this.gain.value = 1; }
}
export class OscFalso extends NoFalso {
  type = 'sine';
  frequency = new ParamFalso();
  detune = new ParamFalso();
  buffer: unknown = null;
  loop = false;
  inicio: number | null = null;
  fim: number | null = null;
  start(t = 0) { this.inicio = t; }
  stop(t = 0) { this.fim = t; }
}
class FiltroFalso extends NoFalso { type = 'lowpass'; frequency = new ParamFalso(); Q = new ParamFalso(); }
class CompressorFalso extends NoFalso {
  threshold = new ParamFalso(); knee = new ParamFalso(); ratio = new ParamFalso(); attack = new ParamFalso(); release = new ParamFalso();
}
export class ContextoFalso {
  currentTime = 0;
  sampleRate = 8000;
  state: AudioContextState = 'suspended';
  destination = new NoFalso();
  criados: NoFalso[] = [];
  resumidos = 0;
  fechados = 0;
  /** O navegador não deixa (sem gesto, ligação no celular): o resume() é recusado e o estado fica. */
  recusar = false;
  /** Como no navegador de verdade: o resume() só liga depois (numa microtarefa), não na hora. */
  resumeAssincrono = false;
  private ouvintes: (() => void)[] = [];
  private novo<T extends NoFalso>(n: T): T { this.criados.push(n); return n; }
  createGain() { return this.novo(new GanhoFalso()); }
  createOscillator() { return this.novo(new OscFalso()); }
  createBufferSource() { return this.novo(new OscFalso()); }
  createBiquadFilter() { return this.novo(new FiltroFalso()); }
  createDynamicsCompressor() { return this.novo(new CompressorFalso()); }
  createBuffer(_canais: number, n: number) { const d = new Float32Array(n); return { length: n, getChannelData: () => d }; }
  addEventListener(tipo: string, f: () => void) { if (tipo === 'statechange') this.ouvintes.push(f); }
  /** Troca o estado como o navegador faria, avisando no `statechange` (mudar `state` direto não avisa ninguém). */
  mudar(estado: AudioContextState | 'interrupted') {
    if (this.state === estado) return;
    this.state = estado as AudioContextState;
    for (const f of [...this.ouvintes]) f();
  }
  resume() {
    this.resumidos++;
    if (this.recusar || this.state === 'closed') return Promise.reject(new Error('o navegador não deixou'));
    if (this.resumeAssincrono) return Promise.resolve().then(() => { if (this.state !== 'closed') this.mudar('running'); });
    this.mudar('running');
    return Promise.resolve();
  }
  suspend() { this.mudar('suspended'); return Promise.resolve(); }
  close() { this.fechados++; this.mudar('closed'); return Promise.resolve(); }
  osciladores() { return this.criados.filter((n): n is OscFalso => n instanceof OscFalso); }
  ganhos() { return this.criados.filter((n): n is GanhoFalso => n instanceof GanhoFalso); }
}
export const comoContexto = (c: ContextoFalso) => c as unknown as AudioContext;
export const destinoFalso = (c: ContextoFalso) => c.destination as unknown as AudioNode;
