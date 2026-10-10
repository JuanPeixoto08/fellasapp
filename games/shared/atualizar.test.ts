// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bundleAberto, bundleDe, INTERVALO_MS, versaoNova, vigiarVersao } from './atualizar';

const html = (bundle: string) =>
  `<!doctype html><html><head><script type="module" crossorigin src="${bundle}"></script>` +
  `<link rel="modulepreload" crossorigin href="/games/assets/hud-AAA.js"></head><body></body></html>`;
const resposta = (texto: string, ok = true) => Promise.resolve({ ok, text: () => Promise.resolve(texto) } as Response);

beforeEach(() => {
  document.head.innerHTML = '<script type="text/plain" src="/games/assets/idle-VELHO.js"></script>'; // text/plain: o happy-dom não tenta carregar
  sessionStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('versão nova da página de jogo', () => {
  it('lê o bundle do index.html (o script, não o modulepreload) e o da página aberta', () => {
    expect(bundleDe(html('/games/assets/idle-NOVO.js'))).toBe('/games/assets/idle-NOVO.js');
    expect(bundleDe('<html></html>')).toBeNull();
    expect(bundleAberto()).toBe('/games/assets/idle-VELHO.js');
  });
  it('avisa só quando o servidor aponta pra outro bundle; erro de rede ou dev = nada', async () => {
    expect(await versaoNova(() => resposta(html('/games/assets/idle-NOVO.js')))).toBe('/games/assets/idle-NOVO.js');
    expect(await versaoNova(() => resposta(html('/games/assets/idle-VELHO.js')))).toBeNull();
    expect(await versaoNova(() => resposta('', false))).toBeNull();
    expect(await versaoNova(() => Promise.reject(new Error('offline')))).toBeNull();
    document.head.innerHTML = '<script type="text/plain" src="/idle/main.ts"></script>'; // dev do Vite
    expect(await versaoNova(() => resposta(html('/games/assets/idle-NOVO.js')))).toBeNull();
  });
  it('recarrega uma vez por bundle novo, ao abrir e ao voltar pra aba (no máximo uma conferência por minuto)', async () => {
    vi.useFakeTimers();
    const recarregar = vi.fn();
    const buscar = vi.fn(() => resposta(html('/games/assets/idle-NOVO.js')));
    const parar = vigiarVersao(recarregar, buscar);
    await vi.waitFor(() => expect(recarregar).toHaveBeenCalledTimes(1));
    // voltou pra aba logo depois: não busca de novo
    document.dispatchEvent(new Event('visibilitychange'));
    expect(buscar).toHaveBeenCalledTimes(1);
    // um minuto depois busca, mas já recarregou por esse bundle: não recarrega em loop
    vi.advanceTimersByTime(INTERVALO_MS);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(buscar).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(recarregar).toHaveBeenCalledTimes(1);
    parar();
  });
});
