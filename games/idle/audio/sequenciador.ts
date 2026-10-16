// Toca a partitura: agenda as notas um pouco à frente no relógio do áudio (o setInterval só acorda; quem marca o tempo
// é o contexto) e troca de era no fim do giro, alternando o tema e o solo.
import { INSTRUMENTOS, type Toque } from './instrumentos';
import { batidasDoGiro, bpm, eraMusica, notasDoGiro, type Instrumento, type Nota } from './musica';
import { criarSala, molhadoDaEra, type Sala } from './sala';

export const ADIANTE_S = 0.12;
export const PASSO_MS = 25;
const ATRASO_MAX_S = 0.1; // nota que já passou disso fica de fora (não sai tudo junto depois de um engasgo)

export type Fonte = { ctx(): BaseAudioContext | null; destino(): AudioNode | null };
export type Sequenciador = { tocar(era: number): void; mudarEra(era: number): void; parar(): void; tocando(): boolean; passo(): void };

export function criarSequenciador(
  f: Fonte,
  opcoes: {
    notas?: (era: number, giro: number) => Nota[]; toques?: Record<Instrumento, Toque>; relogio?: boolean;
    /** Quanto agendar à frente (s); com a aba escondida no PC o giro inteiro (o navegador quase não acorda a aba). */
    adiante?: () => number;
  } = {},
): Sequenciador {
  const notas = opcoes.notas ?? notasDoGiro;
  const toques = opcoes.toques ?? INSTRUMENTOS;
  let ativo = false;
  let era = 1;
  let eraNova = 1;
  let giro = 0;
  let inicio = 0;
  let lista: Nota[] = [];
  let i = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  // canal próprio de cada rodada: parar desliga ele e corta o que já estava agendado
  let canal: GainNode | null = null;
  let destinoRodada: AudioNode | null = null;
  let sala: Sala | null = null; // o envio de reverb da rodada (o molhado segue a era)
  const spb = () => 60 / bpm(era);
  // a sala (convolução de 3,2 s) só existe quando a era da música pede molhado (6+): nas eras 0–5 nem é criada
  function ligarSala(ctx: BaseAudioContext, quando: number) {
    const molhado = molhadoDaEra(era);
    if (!sala && molhado > 0 && canal && destinoRodada) {
      sala = criarSala(ctx, destinoRodada);
      canal.connect(sala.entrada); // o envio pra sala
    }
    sala?.molhado(molhado, quando);
  }

  function passo() {
    const ctx = f.ctx();
    const dest = canal;
    if (!ativo || !ctx || !dest) return;
    const agora = ctx.currentTime;
    const ate = agora + (opcoes.adiante?.() ?? ADIANTE_S);
    for (;;) {
      while (i < lista.length && inicio + lista[i].t * spb() < ate) {
        const n = lista[i++];
        const quando = inicio + n.t * spb();
        if (quando < agora - ATRASO_MAX_S) continue;
        toques[n.inst](ctx, dest, Math.max(quando, agora), n.altura, n.dur * spb(), n.forca);
      }
      const fim = inicio + batidasDoGiro(era) * spb();
      if (i < lista.length || fim >= ate) break;
      inicio = fim;
      giro = 1 - giro;
      era = eraNova;
      ligarSala(ctx, inicio);
      lista = notas(era, giro);
      i = 0;
    }
  }

  return {
    tocar(e) {
      if (ativo) {
        eraNova = eraMusica(e);
        return;
      }
      const ctx = f.ctx();
      const destino = f.destino();
      if (!ctx || !destino) return;
      canal = ctx.createGain();
      canal.connect(destino); // o seco
      destinoRodada = destino;
      era = eraNova = eraMusica(e);
      ligarSala(ctx, ctx.currentTime);
      ativo = true;
      giro = 0;
      lista = notas(era, giro);
      i = 0;
      inicio = ctx.currentTime + 0.1;
      passo();
      if (opcoes.relogio !== false) timer = setInterval(passo, PASSO_MS);
    },
    mudarEra(e) {
      eraNova = eraMusica(e);
    },
    parar() {
      ativo = false;
      canal?.disconnect();
      canal = null;
      sala?.desligar();
      sala = null;
      destinoRodada = null;
      if (timer) clearInterval(timer);
      timer = null;
    },
    tocando: () => ativo,
    passo,
  };
}
