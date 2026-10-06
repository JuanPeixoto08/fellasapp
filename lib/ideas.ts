/** Mural de ideias: tipos e regras sem rede (voto estilo Reddit, limite do texto). */

export const IDEA_MAX = 280;
/** O contador de caracteres só aparece daqui pra cima. */
export const IDEA_COUNTER_FROM = 240;

export type Vote = 1 | -1 | null;
export type IdeaSort = 'top' | 'new';
export type IdeaAuthor = { id: string; name: string; avatarUrl: string | null };
export type Idea = {
  id: string;
  body: string;
  createdAt: string;
  author: IdeaAuthor;
  score: number;
  myVote: Vote;
};

/** Toque numa seta: a mesma seta tira o voto; a outra troca (e a pontuação anda 2). */
export function applyVote(idea: { score: number; myVote: Vote }, tapped: 1 | -1): { score: number; myVote: Vote } {
  const myVote: Vote = idea.myVote === tapped ? null : tapped;
  return { myVote, score: idea.score - (idea.myVote ?? 0) + (myVote ?? 0) };
}

/** Texto aparado pronto pra mandar, ou null se vazio/longo demais. */
export function validateIdea(text: string): string | null {
  const body = text.trim();
  return body.length >= 1 && body.length <= IDEA_MAX ? body : null;
}

/** "−3" com o sinal de menos tipográfico (o hífen fica curto ao lado do número). */
export function formatScore(score: number): string {
  return score < 0 ? `−${Math.abs(score)}` : String(score);
}

export function remainingLabel(text: string): string | null {
  return text.length > IDEA_COUNTER_FROM ? `${IDEA_MAX - text.length} restantes` : null;
}
