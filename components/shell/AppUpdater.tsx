import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { alreadyReloadedFor, markReloadedFor, newVersion } from '../../lib/appUpdate';
import { draftIsEmpty } from '../../lib/composerDraft';

/** Intervalo mínimo entre duas conferências (voltar pro app várias vezes seguidas não vira várias buscas). */
export const UPDATE_CHECK_MS = 60_000;

const reloadPage = () => window.location.reload();

/**
 * Web/PWA/APK: ao abrir e ao voltar pro app, confere se saiu versão nova do site e recarrega sozinho, no mesmo
 * endereço. O APK (casca do Chrome) segura a página antiga na memória enquanto fica em segundo plano, e quando
 * o Chrome restaura a aba ele abre a cópia do cache (já na tela, sem "voltar"): sem isto, a pessoa ficava dias
 * numa versão velha. Com post sendo escrito não recarrega (o rascunho vive na memória): fica pra próxima volta.
 */
export function AppUpdater({ reload = reloadPage }: { reload?: () => void }) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let last = -UPDATE_CHECK_MS;
    let checking = false;
    const check = () => {
      if (checking || Date.now() - last < UPDATE_CHECK_MS) return;
      checking = true;
      last = Date.now();
      newVersion()
        .then((fresh) => {
          if (!fresh || !draftIsEmpty() || alreadyReloadedFor(fresh)) return;
          markReloadedFor(fresh);
          reload();
        })
        .finally(() => {
          checking = false;
        });
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [reload]);
  return null;
}
