// Toca as cenas (quadros de 160x96 lado a lado) num canvas de 160x96; o CSS amplia por um inteiro.
// Cena em camadas (assets/cenas/<nome>-fundo, -frente, -vagas) ganha gente: a tira é montada uma vez por
// (cena, gente) e guardada; mudou visual ou contrato, monta de novo (até lá, toca a anterior). Sem a arte nova,
// toca a tira antiga.
import type { Camadas } from './ativos';
import { montarTira, ocuparVagas, type Kit } from './montagem';
import { carregarImagem, pintar } from './navegador';
import { chave, PADRAO, type Visual } from './personagem';

export type NomeCena = 'cena-0-antes' | 'cena-0-abrindo' | 'cena-1' | 'cena-2' | 'cena-3' | 'cena-4' | 'cena-5' | 'cena-6';

export const CENAS: Record<NomeCena, { quadros: number; atrasoMs: number }> = {
  'cena-0-antes': { quadros: 8, atrasoMs: 150 },
  'cena-0-abrindo': { quadros: 12, atrasoMs: 180 },
  'cena-1': { quadros: 8, atrasoMs: 150 },
  'cena-2': { quadros: 8, atrasoMs: 150 },
  'cena-3': { quadros: 8, atrasoMs: 150 },
  'cena-4': { quadros: 8, atrasoMs: 150 },
  'cena-5': { quadros: 12, atrasoMs: 150 },
  'cena-6': { quadros: 8, atrasoMs: 150 },
};
export const LARGURA = 160;
export const ALTURA = 96;

export function quadroEm(nome: NomeCena, decorridoMs: number, umaVez: boolean): number | null {
  const { quadros, atrasoMs } = CENAS[nome];
  const q = Math.floor(decorridoMs / atrasoMs);
  if (umaVez) return q < quadros ? q : null;
  return q % quadros;
}

/** Quem aparece nas cenas: você e sua equipe (contrato mais recente primeiro). */
export type Gente = { dono: Visual; equipe: Visual[] };
export const chaveGente = (g: Gente) => [chave(g.dono), ...g.equipe.map(chave)].join('|');

export function criarPalco(canvas: HTMLCanvasElement, camadas: (nome: NomeCena) => Camadas, kit: Promise<Kit | null> | (() => Promise<Kit | null>)) {
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  let gente: Gente = { dono: PADRAO, equipe: [] };
  const tiras = new Map<string, HTMLCanvasElement>(); // por cena + gente
  const ultima = new Map<NomeCena, HTMLCanvasElement>(); // a última tira pronta de cada cena (toca enquanto monta a nova)
  const pedidas = new Set<string>();
  const falhas = new Set<string>();
  const chaveDe = (nome: NomeCena) => `${nome}#${chaveGente(gente)}`;

  function pedir(nome: NomeCena) {
    const k = chaveDe(nome);
    if (tiras.has(k) || pedidas.has(k) || falhas.has(k)) return;
    pedidas.add(k);
    const c = camadas(nome);
    const quem = gente;
    void (async () => {
      // o kit só é preciso quando a cena tem vagas (tira antiga, sem gente, não depende dele)
      let kitFalhou: unknown = null;
      const pedirKit = c.vagas ? (typeof kit === 'function' ? kit() : kit).catch((e) => { kitFalhou = e ?? new Error('kit'); return null; }) : null;
      const [fundo, frente, k2] = await Promise.all([carregarImagem(c.fundo), c.frente ? carregarImagem(c.frente) : null, pedirKit]);
      const tira = c.vagas ? montarTira({ fundo, frente, vagas: c.vagas }, ocuparVagas(c.vagas, quem.dono, quem.equipe), k2) : fundo;
      const cv = document.createElement('canvas');
      pintar(cv, tira);
      if (kitFalhou) {
        // fundo + frente sem gente: toca, mas não guarda a tira, pra nova tentativa montar com gente
        console.warn(`Fellas Inc.: o kit de personagens não carregou; a cena ${nome} vai sem gente por enquanto`, kitFalhou);
        if (k === chaveDe(nome)) ultima.set(nome, cv);
        falhas.add(k);
        setTimeout(() => falhas.delete(k), 30_000);
        return;
      }
      tiras.set(k, cv);
      if (k === chaveDe(nome)) ultima.set(nome, cv);
    })()
      .catch((e) => {
        // avisa e deixa tentar de novo daqui a 30 s (ou antes, se a cena ou a gente mudar)
        console.warn(`Fellas Inc.: a cena ${nome} não montou (${c.fundo}${c.frente ? `, ${c.frente}` : ''})`, e);
        falhas.add(k);
        setTimeout(() => falhas.delete(k), 30_000);
      })
      .finally(() => pedidas.delete(k));
  }

  let atual: { nome: NomeCena; inicio: number; umaVez: boolean; aoTerminar?: () => void } | null = null;
  let raf = 0;

  const quadro = (agora: number) => {
    raf = 0;
    if (!atual) return;
    const q = quadroEm(atual.nome, Math.max(0, agora - atual.inicio), atual.umaVez);
    if (q === null) {
      const fim = atual.aoTerminar;
      atual = null;
      fim?.();
      return;
    }
    const tira = tiras.get(chaveDe(atual.nome)) ?? ultima.get(atual.nome);
    if (!tiras.has(chaveDe(atual.nome))) pedir(atual.nome);
    if (tira) g.drawImage(tira, q * LARGURA, 0, LARGURA, ALTURA, 0, 0, LARGURA, ALTURA);
    if (!document.hidden) raf = requestAnimationFrame(quadro);
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && atual && !raf) raf = requestAnimationFrame(quadro);
  });

  return {
    tocar(nome: NomeCena, opcoes: { umaVez?: boolean; aoTerminar?: () => void } = {}) {
      if (atual?.nome === nome && !opcoes.umaVez) return; // já está tocando: não reinicia o loop
      if (atual?.nome !== nome) falhas.clear(); // cena nova: tenta de novo o que tinha falhado
      atual = { nome, inicio: performance.now(), umaVez: !!opcoes.umaVez, aoTerminar: opcoes.aoTerminar };
      pedir(nome);
      if (!raf) raf = requestAnimationFrame(quadro);
    },
    parar() {
      atual = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    /** Troca quem aparece nas cenas (visual salvo, contrato novo). Só remonta se mudou. */
    gente(nova: Gente) {
      const k = chaveGente(nova);
      if (k === chaveGente(gente)) return;
      gente = nova;
      falhas.clear();
      for (const x of [...tiras.keys()]) if (!x.endsWith(`#${k}`)) tiras.delete(x);
      if (atual) pedir(atual.nome);
    },
    /** Monta antes de precisar (a cena de abrir a empresa toca uma vez só, logo depois do toque). */
    preparar(nomes: NomeCena[]) {
      for (const n of nomes) pedir(n);
    },
  };
}
