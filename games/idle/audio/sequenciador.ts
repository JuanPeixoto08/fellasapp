// Toca a partitura: agenda as notas um pouco à frente no relógio do áudio (o setInterval só acorda; quem marca o tempo
// é o contexto) e troca de era no fim do giro, alternando o tema e o solo.
import { INSTRUMENTOS, type Toque } from './instrumentos';
import { BATIDAS_GIRO, bpm, eraMusica, notasDoGiro, type Instrumento, type Nota } from './musica';

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
  const spb = () => 60 / bpm(era);

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
      const fim = inicio + BATIDAS_GIRO * spb();
      if (i < lista.length || fim >= ate) break;
      inicio = fim;
      giro = 1 - giro;
      era = eraNova;
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
      canal.connect(destino);
      era = eraNova = eraMusica(e);
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
      if (timer) clearInterval(timer);
      timer = null;
    },
    tocando: () => ativo,
    passo,
  };
}
