import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadRawEmojis } from './emojiData';

/** Barra rápida de reações (estilo WhatsApp); o "+" abre o seletor com todos. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export type EmojiItem = {
  emoji: string;
  /** Nome em pt (ex.: "rosto chorando de rir"), usado como rótulo acessível. */
  label: string;
  /** Nome + apelidos já normalizados (minúsculas, sem acento) para a busca. */
  search: string;
};

export type EmojiGroup = { key: string; title: string; emojis: EmojiItem[] };

type RawEmoji = { group?: number; order?: number; label: string; tags?: string[]; unicode: string };

/**
 * Categorias na ordem do Unicode. Fora: "component" (2: tons de pele soltos) e emojis sem grupo
 * (letras de bandeira avulsas). O título de "flags" no pacote veio traduzido errado ("comutadores").
 */
const GROUPS: { id: number; key: string; title: string }[] = [
  { id: 0, key: 'smileys', title: 'Sorrisos e emoção' },
  { id: 1, key: 'people', title: 'Pessoas e corpo' },
  { id: 3, key: 'animals', title: 'Animais e natureza' },
  { id: 4, key: 'food', title: 'Comida e bebida' },
  { id: 5, key: 'travel', title: 'Viagens e lugares' },
  { id: 6, key: 'activities', title: 'Atividades' },
  { id: 7, key: 'objects', title: 'Objetos' },
  { id: 8, key: 'symbols', title: 'Símbolos' },
  { id: 9, key: 'flags', title: 'Bandeiras' },
];

/** Minúsculas e sem acento: "Gargalhada" e "gargalhadá" acham o mesmo. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function groupEmojis(raw: RawEmoji[]): EmojiGroup[] {
  return GROUPS.map(({ id, key, title }) => ({
    key,
    title,
    emojis: raw
      .filter((e) => e.group === id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((e) => ({
        emoji: e.unicode,
        label: e.label,
        search: normalize([e.label, ...(e.tags ?? [])].join(' ')),
      })),
  }));
}

let cache: Promise<EmojiGroup[]> | null = null;

/** Carrega os ~1900 emojis só quando o seletor abre (fora do bundle inicial). */
export function loadEmojiGroups(): Promise<EmojiGroup[]> {
  if (!cache) {
    cache = loadRawEmojis()
      .then((raw) => groupEmojis(raw as RawEmoji[]))
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}

/** Busca por nome ou apelido ("kkk" acha 😂); quem começa com o termo vem primeiro. */
export function searchEmojis(groups: EmojiGroup[], query: string, limit = 120): EmojiItem[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const starts: EmojiItem[] = [];
  const contains: EmojiItem[] = [];
  for (const group of groups) {
    for (const item of group.emojis) {
      if (item.search.startsWith(q) || item.search.includes(` ${q}`)) starts.push(item);
      else if (item.search.includes(q)) contains.push(item);
    }
  }
  return [...starts, ...contains].slice(0, limit);
}

const RECENTS_KEY = 'fellas.recentEmojis';
const MAX_RECENTS = 24;

/** Emojis usados por último neste aparelho (mais recente primeiro). Falha de storage = lista vazia. */
export async function getRecentEmojis(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((e): e is string => typeof e === 'string') : [];
  } catch {
    return [];
  }
}

export async function pushRecentEmoji(emoji: string): Promise<string[]> {
  const next = [emoji, ...(await getRecentEmojis()).filter((e) => e !== emoji)].slice(0, MAX_RECENTS);
  try {
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // recentes são conveniência: sem storage, segue a vida
  }
  return next;
}
