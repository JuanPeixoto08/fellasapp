// URLs das imagens da Fellas Inc. (Vite troca pelos arquivos com hash no build) e o JSON das vagas de cada cena.
import type { Pose, Vagas } from './montagem';
import type { NomeCena } from './palco';

const nomeDe = (arq: string) => arq.split('/').pop()!.replace(/\.(png|json)$/, '');
const pegar = (lista: Record<string, string>) => Object.fromEntries(Object.entries(lista).map(([arq, url]) => [nomeDe(arq), url]));

const cenas = pegar(import.meta.glob('./assets/cenas/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const geradores = pegar(import.meta.glob('./assets/geradores/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const oportunidades = pegar(import.meta.glob('./assets/oportunidades/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const gerais = pegar(import.meta.glob('./assets/gerais/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const conquistas = pegar(import.meta.glob('./assets/conquistas/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const arvore = pegar(import.meta.glob('./assets/arvore/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const pessoas = pegar(import.meta.glob('./assets/pessoas/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const convidados = pegar(import.meta.glob('./assets/convidados/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const vagas = Object.fromEntries(
  Object.entries(import.meta.glob('./assets/cenas/*-vagas.json', { eager: true, import: 'default' }) as Record<string, Vagas>)
    .map(([arq, v]) => [nomeDe(arq).replace(/-vagas$/, ''), v]),
);

/** Uma cena em camadas; sem a arte nova, `fundo` é a tira antiga (com o fundador desenhado) e não há vagas. */
export type Camadas = { fundo: string; frente: string | null; vagas: Vagas | null };

export const ativos = {
  camadas(nome: NomeCena): Camadas {
    const fundo = cenas[`${nome}-fundo`];
    const v = vagas[nome];
    if (fundo && v) return { fundo, frente: cenas[`${nome}-frente`] ?? null, vagas: v };
    return { fundo: cenas[nome], frente: null, vagas: null };
  },
  pose: (p: Pose): string | null => pessoas[`pose-${p}`] ?? null,
  estagiario: (p: Pose): string | null => pessoas[`estagiario-pose-${p}`] ?? null,
  cadeira: (): string | null => pessoas.cadeira ?? null,
  gerador: (id: number) => geradores[`gerador-${String(id).padStart(2, '0')}`],
  oportunidade: (k: 0 | 1 | 2) => oportunidades[`oportunidade-${k}`],
  geral: (id: number): string | null => gerais[`geral-${id}`] ?? null,
  /** Retrato 32x32 do convidado do PPP Podcast (1 a 11). */
  convidado: (id: number): string | null => convidados[`convidado-${String(id).padStart(2, '0')}`] ?? null,
  /** Ícone 16x16 da conquista (null = a arte ainda não chegou). */
  conquista: (id: number): string | null => conquistas[`conquista-${String(id).padStart(3, '0')}`] ?? null,
  /** Ícone 16x16 do nó da árvore (null = a arte ainda não chegou). */
  no: (id: number): string | null => arvore[`no-${String(id).padStart(2, '0')}`] ?? null,
};
