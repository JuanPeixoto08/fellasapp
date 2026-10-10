// Montagem das cenas com gente: fundo → pessoas → frente, quadro a quadro, em bytes (sem canvas). O palco chama isto
// uma vez por (cena, gente) e guarda a tira pronta. Formato dos arquivos: "Contrato de formato da arte" no plano da
// entrega 2 (docs/superpowers/plans/2026-10-10-fellas-inc-gente.md).
import { colar, recortar, vazia, type Imagem } from './imagem';
import type { NomeCena } from './palco';
import { trocarCores, valido, type Visual } from './personagem';

export type Pose = 1 | 2 | 3 | 4 | 5 | 6;
/** Caixa de cada pose: 1 sentado de costas, 2 em pé de costas, 3 em pé de perfil, 4 sentado de perfil, 5 de frente,
 *  6 deitado (só cabeça e ombro). */
export const POSES: Record<Pose, { w: number; h: number }> = {
  1: { w: 16, h: 22 }, 2: { w: 14, h: 26 }, 3: { w: 12, h: 24 }, 4: { w: 14, h: 20 }, 5: { w: 9, h: 13 }, 6: { w: 16, h: 10 },
};
/** A folha de cada pose: 4 colunas de quadros × 16 linhas de peças. */
export const QUADROS_POSE = 4;
export const LINHAS_KIT = 16;
/** Linha 0 corpo; 1–6 cabelo; 7–10 roupa; 11–15 acessório 1–5 (o 0, "nada", não tem linha). */
export const linhaCabelo = (k: number) => 1 + k;
export const linhaRoupa = (k: number) => 7 + k;
export const linhaAcessorio = (k: number) => 10 + k;
export const LARGURA_CENA = 160;
export const ALTURA_CENA = 96;
/** Prévia do editor: a pose 1 em (x, y) e a cadeira (assets/pessoas/cadeira.png) por cima. */
export const CADEIRA = { w: 24, h: 30, x: 4, y: 2 } as const;

export type Kit = { poses: Record<Pose, Imagem>; estagiario: Partial<Record<Pose, Imagem>> };
export type Posicao = { x: number; y: number; pose: Pose; espelhada: boolean };
export type Vaga = Posicao & {
  id: string; papel: 'dono' | 'contratado'; freela?: Visual | 'estagiario'; trilha?: (Partial<Posicao> | null)[];
};
export type Vagas = { quadros: number; vagas: Vaga[] };
export type Ocupante = { visual: Visual } | { estagiario: true };
export type Ocupada = { vaga: Vaga; quem: Ocupante };

/** Quantas vagas de contratado cada cena tem (spec 7.3); null = a cena 6 decide no desenho (até 5). */
export const VAGAS_CONTRATADO: Record<NomeCena, number | null> = {
  'cena-0-antes': 0, 'cena-0-abrindo': 0, 'cena-1': 0, 'cena-2': 1, 'cena-3': 3, 'cena-4': 5, 'cena-5': 4, 'cena-6': null,
};

/** O boneco de um visual numa pose e quadro: corpo → roupa → cabelo → acessório, depois as cores. */
export function boneco(kit: Kit, v: Visual, pose: Pose, quadro: number): Imagem {
  const { w, h } = POSES[pose];
  const folha = kit.poses[pose];
  const q = quadro % QUADROS_POSE;
  const out = vazia(w, h);
  const linhas = [0, linhaRoupa(v.roupa), linhaCabelo(v.cabelo)];
  if (v.acessorio > 0) linhas.push(linhaAcessorio(v.acessorio));
  for (const l of linhas) colar(out, recortar(folha, q * w, l * h, w, h), 0, 0);
  return trocarCores(out, v);
}

export function naCadeira(kit: Kit, cadeira: Imagem, v: Visual): Imagem {
  const out = vazia(CADEIRA.w, CADEIRA.h);
  colar(out, boneco(kit, v, 1, 0), CADEIRA.x, CADEIRA.y);
  colar(out, cadeira, 0, 0);
  return out;
}

/** Quem fica em cada vaga: você na de dono; a equipe (contrato mais recente primeiro) nas de contratado, na ordem do
 *  JSON; vaga sobrando fica com o freela dela. */
export function ocuparVagas(v: Vagas, dono: Visual, equipe: Visual[]): Ocupada[] {
  const out: Ocupada[] = [];
  let i = 0;
  for (const vaga of v.vagas) {
    if (vaga.papel === 'dono') out.push({ vaga, quem: { visual: dono } });
    else if (i < equipe.length) out.push({ vaga, quem: { visual: equipe[i++] } });
    else if (vaga.freela === 'estagiario') out.push({ vaga, quem: { estagiario: true } });
    else if (vaga.freela) out.push({ vaga, quem: { visual: vaga.freela } });
  }
  return out;
}

/** Onde a vaga está no quadro f (a trilha muda por quadro; null = some). */
export function posicaoNoQuadro(vaga: Vaga, f: number): Posicao | null {
  const base: Posicao = { x: vaga.x, y: vaga.y, pose: vaga.pose, espelhada: vaga.espelhada };
  if (!vaga.trilha) return base;
  const t = vaga.trilha[f % vaga.trilha.length];
  return t === null ? null : { ...base, ...t };
}

function sprite(kit: Kit, quem: Ocupante, pose: Pose, quadro: number): Imagem | null {
  if ('visual' in quem) return boneco(kit, quem.visual, pose, quadro);
  const folha = kit.estagiario[pose];
  if (!folha) return null;
  const { w, h } = POSES[pose];
  return recortar(folha, (quadro % QUADROS_POSE) * w, 0, w, h);
}

/** A tira pronta (quadros × 160 por 96). Sem kit (arte não carregou), só fundo e frente. */
export function montarTira(c: { fundo: Imagem; frente: Imagem | null; vagas: Vagas }, gente: Ocupada[], kit: Kit | null): Imagem {
  const n = c.vagas.quadros;
  const tira = vazia(n * LARGURA_CENA, ALTURA_CENA);
  for (let f = 0; f < n; f++) {
    const quadro = recortar(c.fundo, f * LARGURA_CENA, 0, LARGURA_CENA, ALTURA_CENA);
    if (kit) {
      const aqui = gente
        .map((o, ordem) => ({ o, ordem, p: posicaoNoQuadro(o.vaga, f) }))
        .filter((x): x is { o: Ocupada; ordem: number; p: Posicao } => x.p !== null)
        .sort((a, b) => a.p.y + POSES[a.p.pose].h - (b.p.y + POSES[b.p.pose].h) || a.ordem - b.ordem);
      for (const { o, p } of aqui) {
        const s = sprite(kit, o.quem, p.pose, f);
        if (s) colar(quadro, s, p.x, p.y, p.espelhada);
      }
    }
    if (c.frente) colar(quadro, recortar(c.frente, f * LARGURA_CENA, 0, LARGURA_CENA, ALTURA_CENA), 0, 0);
    colar(tira, quadro, f * LARGURA_CENA, 0);
  }
  return tira;
}

/** Erros do JSON de vagas (lista vazia = ok). `contratados`: quantas vagas de contratado a cena precisa (null = livre). */
export function validarVagas(x: unknown, quadros: number, contratados: number | null): string[] {
  const v = x as Vagas | null;
  if (!v || typeof v !== 'object' || !Array.isArray(v.vagas)) return ['sem lista de vagas'];
  const erros: string[] = [];
  if (v.quadros !== quadros) erros.push(`quadros ${v.quadros} ≠ ${quadros}`);
  const donos = v.vagas.filter((g) => g.papel === 'dono').length;
  if (donos !== 1) erros.push(`${donos} vagas de dono (precisa de 1)`);
  const n = v.vagas.filter((g) => g.papel === 'contratado').length;
  if (contratados !== null && n !== contratados) erros.push(`${n} vagas de contratado (precisa de ${contratados})`);
  const ids = new Set<string>();
  for (const g of v.vagas) {
    if (typeof g.id !== 'string' || !g.id || ids.has(g.id)) erros.push(`id repetido ou vazio: ${g.id}`);
    ids.add(g.id);
    if (g.papel !== 'dono' && g.papel !== 'contratado') erros.push(`${g.id}: papel ${g.papel}`);
    if (g.papel === 'contratado' && !g.freela) erros.push(`${g.id}: vaga de contratado sem freela`);
    if (g.freela && g.freela !== 'estagiario' && !valido(g.freela)) erros.push(`${g.id}: freela com visual inválido`);
    if (g.trilha && g.trilha.length !== quadros) erros.push(`${g.id}: trilha com ${g.trilha.length} quadros`);
    for (let f = 0; f < quadros; f++) {
      const p = posicaoNoQuadro(g, f);
      if (!p) continue;
      if (!(p.pose in POSES)) {
        erros.push(`${g.id}: pose ${p.pose}`);
        continue;
      }
      const { w, h } = POSES[p.pose];
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x + w > LARGURA_CENA || p.y + h > ALTURA_CENA)
        erros.push(`${g.id}: fora da cena no quadro ${f}`);
      if (typeof p.espelhada !== 'boolean') erros.push(`${g.id}: espelhada não é true/false`);
    }
  }
  return erros;
}
