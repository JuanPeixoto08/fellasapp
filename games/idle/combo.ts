// Combo (0076): pegar 3 dourados seguidos sem nenhum sumir no meio dá ×7 por 1 min. Quem conta é o banco (combo_n,
// combo_seg); a página só descobre se o combo em andamento já quebrou: um dourado da sorte (não Tigrinho) depois do último
// pego, que passou da janela sem ser pego. A mesma regra de idle_combo_quebrou. Olha cada segundo uma vez só (guarda até
// onde já olhou, por jogador e combo_seg).
import { eventoDaSorte } from './convidados';
import { CHUVA_S, COMBO_JANELA_S } from './dourados';

type ComCombo = Parameters<typeof eventoDaSorte>[0] & { combo_n?: number; combo_seg?: number | null };
const vistos = new Map<string, { ate: number; quebrou: boolean }>();

/** Quantos dourados o combo em andamento já tem agora (0 = nenhum ou quebrou). */
export function comboAgora(s: ComCombo, agoraMs: number): number {
  const n = s.combo_n ?? 0;
  const de = s.combo_seg ?? null;
  if (n <= 0 || de === null) return 0;
  const agoraS = agoraMs / 1000;
  if (de < Math.floor(agoraS) - COMBO_JANELA_S) return 0;
  const chave = `${s.user_id}:${de}`;
  if (vistos.size > 50 && !vistos.has(chave)) vistos.clear();
  const v = vistos.get(chave) ?? { ate: de, quebrou: false };
  for (let x = v.ate + 1; !v.quebrou && x < agoraS; x++) {
    const e = eventoDaSorte(s, x);
    // um segundo com dourado só fica decidido quando a janela dele passa (a da tela + os 8 s do Trend/Pix + 3 s de folga)
    if (e && agoraS <= x + e.janelaS + (e.tipo === 4 || e.tipo === 6 ? CHUVA_S : 0) + 3) break;
    if (e && e.tipo !== 7) v.quebrou = true;
    v.ate = x;
  }
  vistos.set(chave, v);
  return v.quebrou ? 0 : n;
}
