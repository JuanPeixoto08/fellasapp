import { View } from 'react-native';

import { Button, Heading, Screen, Text } from '../components/ui';
import { useSession } from '../lib/auth/SessionProvider';
import { useTheme } from '../lib/theme';

export default function NotInvitedScreen() {
  const { session, signOut } = useSession();
  const t = useTheme();
  const email = session?.user?.email;
  return (
    <Screen scroll style={{ paddingTop: t.spacing.xxxl, gap: t.spacing.xl }}>
      <View style={{ gap: t.spacing.md }}>
        <Heading level={1}>Você ainda não foi convidado</Heading>
        <Text tone="muted">
          Este app é só para um grupo fechado de amigos. Pede pra alguém do grupo liberar o seu email e
          volta aqui, bora.
        </Text>
        {email ? (
          <Text tone="muted">
            Você entrou como{' '}
            <Text highlight bold>
              {email}
            </Text>
            . Se não é esse, sai e tenta com o certo.
          </Text>
        ) : null}
      </View>
      <Button title="Sair" variant="secondary" onPress={() => void signOut()} fullWidth />
    </Screen>
  );
}
