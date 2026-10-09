import { avatarPalette } from './theme';

/** Tamanho das iniciais em relação ao avatar. */
export const INITIALS_SCALE = 0.4;

/** "Caio Ramos" → "CR"; um nome só → uma letra; vazio → "?". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (parts[0][0] + last).toUpperCase();
}

/** Cor de papel/pastel do avatar sem foto, sempre a mesma para o mesmo nome. */
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return avatarPalette[h % avatarPalette.length];
}
