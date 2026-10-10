// O que só roda no navegador: ler PNG em bytes (pelo canvas), pintar bytes num canvas, carregar o kit de personagem
// e desenhar bonecos soltos (cartas, placar, editor). Sem a arte do kit (null), nada é desenhado e o jogo segue.
import { ativos } from './ativos';
import type { Imagem } from './imagem';
import { boneco, naCadeira, type Kit, type Pose } from './montagem';
import type { Visual } from './personagem';

export type Desenhar = (canvas: HTMLCanvasElement, v: Visual, opcoes?: { pose?: Pose; cadeira?: boolean }) => void;

const POSES_KIT: Pose[] = [1, 2, 3, 4, 5, 6];
const cache = new Map<string, Promise<Imagem>>();

export function carregarImagem(url: string): Promise<Imagem> {
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
    })();
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}

export function pintar(canvas: HTMLCanvasElement, img: Imagem): void {
  canvas.width = img.w;
  canvas.height = img.h;
  canvas.getContext('2d')?.putImageData(new ImageData(img.d, img.w, img.h), 0, 0);
}

let kitEmCurso: Promise<Kit | null> | null = null;

/** O kit inteiro (null = a arte ainda não existe). Falha de rede avisa no console e tenta de novo (3 vezes, esperando
 *  5 s e 10 s); se esgotar, rejeita (o palco avisa e chama de novo mais tarde). Só o sucesso fica guardado. */
export function carregarKit(): Promise<Kit | null> {
  if (!kitEmCurso) {
    const p = lerKit();
    kitEmCurso = p;
    p.catch(() => {
      if (kitEmCurso === p) kitEmCurso = null;
    });
  }
  return kitEmCurso;
}

async function lerKit(tentativas = 3): Promise<Kit | null> {
  const urls = POSES_KIT.map((p) => ativos.pose(p));
  if (urls.some((u) => !u)) return null; // a arte do kit ainda não chegou: cenas antigas, sem gente
  let erro: unknown;
  for (let i = 1; i <= tentativas; i++) {
    try {
      const folhas = await Promise.all(urls.map((u) => carregarImagem(u!)));
      const poses = Object.fromEntries(POSES_KIT.map((p, j) => [p, folhas[j]])) as Record<Pose, Imagem>;
      const estagiario: Kit['estagiario'] = {};
      for (const p of POSES_KIT) {
        const u = ativos.estagiario(p);
        if (u) estagiario[p] = await carregarImagem(u);
      }
      return { poses, estagiario };
    } catch (e) {
      erro = e;
      console.warn(`Fellas Inc.: o kit de personagem não carregou (tentativa ${i} de ${tentativas})`, e);
      if (i < tentativas) await new Promise((ok) => setTimeout(ok, 5000 * i));
    }
  }
  throw erro;
}

export function criarDesenhista(kit: Kit | null, cadeira: Imagem | null): Desenhar {
  return (canvas, v, opcoes = {}) => {
    if (!kit) return;
    pintar(canvas, opcoes.cadeira && cadeira ? naCadeira(kit, cadeira, v) : boneco(kit, v, opcoes.pose ?? 5, 0));
  };
}
