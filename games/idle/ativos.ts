// URLs das imagens da Fellas Inc. (Vite troca pelos arquivos com hash no build).
import type { NomeCena } from './palco';

const pegar = (lista: Record<string, string>) =>
  Object.fromEntries(Object.entries(lista).map(([arq, url]) => [arq.split('/').pop()!.replace('.png', ''), url]));

const cenas = pegar(import.meta.glob('./assets/cenas/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const geradores = pegar(import.meta.glob('./assets/geradores/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const oportunidades = pegar(import.meta.glob('./assets/oportunidades/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const gerais = pegar(import.meta.glob('./assets/gerais/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);

export const ativos = {
  cenas: cenas as Record<NomeCena, string>,
  gerador: (id: number) => geradores[`gerador-${String(id).padStart(2, '0')}`],
  oportunidade: (k: 0 | 1 | 2) => oportunidades[`oportunidade-${k}`],
  geral: (id: number): string | null => gerais[`geral-${id}`] ?? null,
};
