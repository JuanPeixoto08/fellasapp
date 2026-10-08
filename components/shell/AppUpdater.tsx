import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { hasNewVersion } from '../../lib/appUpdate';
import { draftIsEmpty } from '../../lib/composerDraft';

/** Intervalo mínimo entre duas conferências (voltar pro app várias vezes seguidas não vira várias buscas). */
export const UPDATE_CHECK_MS = 60_000;

const reloadPage = () => window.location.reload();

/**
 * Web/PWA/APK: ao voltar pro app, confere se saiu versão nova do site e recarrega sozinho, no mesmo endereço.
 * O APK (casca do Chrome) segura a página antiga na memória enquanto fica em segundo plano; sem isto, a
 * atualização só aparecia fechando o app. Com post sendo escrito não recarrega (o rascunho vive na memória):
 * fica pra próxima volta.
 */
export function AppUpdater({ reload = reloadPage }: { reload?: () => void }) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let last = 0;
    let checking = false;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || checking || Date.now() - last < UPDATE_CHECK_MS) return;
      checking = true;
      last = Date.now();
      hasNewVersion()
        .then((fresh) => {
          if (fresh && draftIsEmpty()) reload();
        })
        .finally(() => {
          checking = false;
        });
    });
    return () => sub.remove();
  }, [reload]);
  return null;
}
