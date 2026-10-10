// Toca as tiras de cena (quadros de 160x96 lado a lado) num canvas de 160x96; o CSS amplia por um inteiro.
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

export function criarPalco(canvas: HTMLCanvasElement, urls: Record<NomeCena, string>) {
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const imagens = new Map<NomeCena, HTMLImageElement>();
  const imagem = (nome: NomeCena) => {
    let img = imagens.get(nome);
    if (!img) {
      img = new Image();
      img.src = urls[nome];
      imagens.set(nome, img);
    }
    return img;
  };
  let atual: { nome: NomeCena; inicio: number; umaVez: boolean; aoTerminar?: () => void } | null = null;
  let raf = 0;

  const quadro = (agora: number) => {
    raf = 0;
    if (!atual) return;
    const q = quadroEm(atual.nome, agora - atual.inicio, atual.umaVez);
    if (q === null) {
      const fim = atual.aoTerminar;
      atual = null;
      fim?.();
      return;
    }
    const img = imagem(atual.nome);
    if (img.complete && img.naturalWidth) g.drawImage(img, q * LARGURA, 0, LARGURA, ALTURA, 0, 0, LARGURA, ALTURA);
    if (!document.hidden) raf = requestAnimationFrame(quadro);
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && atual && !raf) raf = requestAnimationFrame(quadro);
  });

  return {
    tocar(nome: NomeCena, opcoes: { umaVez?: boolean; aoTerminar?: () => void } = {}) {
      if (atual?.nome === nome && !opcoes.umaVez) return; // já está tocando: não reinicia o loop
      atual = { nome, inicio: performance.now(), umaVez: !!opcoes.umaVez, aoTerminar: opcoes.aoTerminar };
      imagem(nome);
      if (!raf) raf = requestAnimationFrame(quadro);
    },
    parar() {
      atual = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
