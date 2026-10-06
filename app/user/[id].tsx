import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { stackHeader } from '../../components/profile/headerOptions';
import { EmptyState, Screen } from '../../components/ui';
import { getProfile } from '../../lib/api/profiles';
import { useSession } from '../../lib/auth/SessionProvider';
import { profilePath } from '../../lib/openProfile';
import { useTheme } from '../../lib/theme';

/** Links antigos pelo id (`/user/<id>`): vão para o @ da pessoa (`/@usuario`); o meu, para a aba Perfil. */
export default function UserByIdScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession().session?.user.id;
  const [username, setUsername] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!id || id === me) return;
    let alive = true;
    setFailed(false);
    getProfile(id)
      .then((p) => alive && setUsername(p.username))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id, me, attempt]);

  if (id === me) return <Redirect href="/profile" />;
  if (username) return <Redirect href={profilePath(username)} />;
  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Perfil')} />
      {failed ? (
        <Screen header>
          <EmptyState
            title="Não deu pra abrir esse perfil"
            message="Deu ruim na conexão, ou o perfil não existe mais."
            actionLabel="Tentar de novo"
            onAction={retry}
          />
        </Screen>
      ) : (
        <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando perfil" />
      )}
    </>
  );
}
