import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import ProfileView from '../components/ProfileView';
import { stackHeader } from '../components/profile/headerOptions';
import { EmptyState, Screen } from '../components/ui';
import { getProfileByUsername } from '../lib/api/profiles';
import { useSession } from '../lib/auth/SessionProvider';
import { useTheme } from '../lib/theme';

type Found = { status: 'loading' } | { status: 'found'; id: string } | { status: 'missing' } | { status: 'error' };

/**
 * Perfil pelo @: `/@juan`. O meu cai na aba Perfil; @ que ninguém usa (ou que a pessoa trocou) avisa; endereço
 * sem @ não é perfil.
 */
export default function HandleScreen() {
  const t = useTheme();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const raw = String(handle ?? '');
  const username = raw.startsWith('@') ? raw.slice(1).toLowerCase() : null;
  const me = useSession().session?.user.id;
  const [found, setFound] = useState<Found>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!username) return;
    let alive = true;
    setFound({ status: 'loading' });
    getProfileByUsername(username)
      .then((p) => alive && setFound(p ? { status: 'found', id: p.id } : { status: 'missing' }))
      .catch(() => alive && setFound({ status: 'error' }));
    return () => {
      alive = false;
    };
  }, [username, attempt]);

  if (found.status === 'found' && found.id === me) return <Redirect href="/profile" />;

  let body;
  if (!username) {
    body = (
      <Screen header>
        <EmptyState title="Essa página não existe" message="Confere o endereço ou volta pro feed." />
      </Screen>
    );
  } else if (found.status === 'found') {
    body = <ProfileView userId={found.id} header />;
  } else if (found.status === 'missing') {
    body = (
      <Screen header>
        <EmptyState title="Esse perfil não existe" message="Confere o @ ou procura em Membros." />
      </Screen>
    );
  } else if (found.status === 'error') {
    body = (
      <Screen header>
        <EmptyState
          title="Não deu pra carregar esse perfil"
          message="Deu ruim na conexão. Confere a internet e tenta de novo."
          actionLabel="Tentar de novo"
          onAction={retry}
        />
      </Screen>
    );
  } else {
    body = <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando perfil" />;
  }

  return (
    <>
      <Stack.Screen options={stackHeader(t, username ? `@${username}` : 'Perfil')} />
      {body}
    </>
  );
}
