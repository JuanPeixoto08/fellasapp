// Motor de áudio: o contexto (o navegador pode não deixar ligar antes do 1º toque), os barramentos música / efeitos /
// geral até o limitador, o fade com a aba, o "abaixa a música" dos momentos grandes e o socorro quando o sistema
// suspende, fecha ou trava o contexto.
export const VOL_MUSICA = 0.22; // medido na página de audição: a música fica uns 10 dB abaixo dos efeitos principais
export const VOL_EFEITOS = 0.8;
const ABAIXADA = 0.4; // ~−8 dB
const TRAVADO_MS = 2000; // rodando e o relógio do áudio parado esse tempo de relógio de parede: travou

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
  /** Cria (ou retoma) o contexto. Fora de um toque/tecla o navegador pode não deixar: fica suspenso até o próximo. */
  ligar(): void;
  ligado(): boolean;
  ctx(): BaseAudioContext | null;
  saida(): Saida | null;
  /** Volume da música, de 0 (desligada) a 1 (o segue a aba visível). */
  musica(volume: number): void;
  visivel(sim: boolean): void;
  abaixarMusica(segundos: number): void;
  /** Conferência barata: o contexto fechou, ou está rodando com o relógio parado há mais de 2 s? Larga ele (o próximo
   * `ligar` cria outro) e devolve true: o que estava ligado nele (música, agendados) tem que recomeçar. */
  conferir(agoraMs: number): boolean;
};

/** `segundoPlano`: a música segue com a aba escondida (PC); sem ele (celular) apaga e suspende. */
export function criarMotor(fabrica: () => AudioContext, opcoes: { segundoPlano?: boolean } = {}): Motor {
  let ctx: AudioContext | null = null;
  let s: Saida | null = null;
  let volume = 1;
  let aVista = true;
  let pediSuspender = false; // quem suspendeu foi o motor (celular com a aba escondida): o statechange não retoma
  let marcaT = 0; // último currentTime visto rodando…
  let marcaMs: number | null = null; // …e quando (relógio de parede); null = olhar de novo
  const retomar = (c: AudioContext) => {
    pediSuspender = false;
    c.resume().catch(() => {}); // recusado (sem gesto): fica suspenso até o próximo toque
  };
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
        const c = fabrica();
        ctx = c;
        s = montarSaida(c);
        s.musica.gain.value = 0;
        marcaMs = null;
        // o sistema suspendeu sozinho (PC dormiu, fone Bluetooth trocou, ligação no celular): à vista, tenta retomar
        c.addEventListener('statechange', () => {
          if (c !== ctx) return; // o velho, já largado
          marcaMs = null;
          const st = c.state as string;
          if ((st === 'suspended' || st === 'interrupted') && aVista && !pediSuspender) c.resume().catch(() => {});
        });
      }
      if (ctx.state !== 'running') retomar(ctx);
      else pediSuspender = false;
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
      if (!sim && opcoes.segundoPlano) return; // PC: a música continua com outra janela por cima
      aVista = sim;
      if (!ctx) return;
      const c = ctx;
      if (sim) {
        retomar(c);
        fade(1.5);
      } else {
        fade(0.3);
        setTimeout(() => {
          if (aVista || c !== ctx) return;
          pediSuspender = true;
          c.suspend().catch(() => {});
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
    conferir(agoraMs) {
      const c = ctx;
      if (!c) return false;
      if (c.state !== 'closed') {
        if (c.state !== 'running') {
          marcaMs = null; // suspenso o relógio para mesmo
          return false;
        }
        if (marcaMs === null || c.currentTime !== marcaT) {
          marcaT = c.currentTime;
          marcaMs = agoraMs;
          return false;
        }
        if (agoraMs - marcaMs <= TRAVADO_MS) return false;
        c.close().catch(() => {});
      }
      ctx = null;
      s = null;
      marcaMs = null;
      return true;
    },
  };
}
