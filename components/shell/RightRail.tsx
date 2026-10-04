import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { resolveUrl } from '../../lib/api/storage';
import { useSession } from '../../lib/auth/SessionProvider';
import { nextBirthdays } from '../../lib/birthdays';
import { useTheme } from '../../lib/theme';
import { useMembers } from '../../lib/useMembers';
import { Avatar, Button, Heading, Icon, interactiveStyle, Text } from '../ui';

const MAX_MEMBERS = 8;
const MAX_BIRTHDAYS = 3;

/** Coluna da direita (desktop largo): gente do grupo antes de qualquer métrica. */
export function RightRail() {
  const t = useTheme();
  const router = useRouter();
  const myId = useSession().session?.user.id;
  const { members, avatars, loading, error, reload } = useMembers();
  const birthdays = useMemo(() => nextBirthdays(members, new Date(), MAX_BIRTHDAYS), [members]);
  const open = (id: string) => router.push(id === myId ? '/profile' : `/user/${id}`);

  const row = (state: Parameters<typeof interactiveStyle>[1]) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.md,
    minHeight: t.layout.minTouch,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.radii.md,
    ...interactiveStyle(t, state),
  });

  return (
    <ScrollView
      style={{ width: t.layout.railWidth, flexGrow: 0 }}
      contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.xl }}
    >
      <View style={{ gap: t.spacing.xs }}>
        <Heading level={3}>Os fellas</Heading>
        {loading ? (
          <ActivityIndicator color={t.colors.primary} accessibilityLabel="Carregando os fellas" />
        ) : error ? (
          <View style={{ gap: t.spacing.xs, alignItems: 'flex-start' }}>
            <Text variant="small" tone="muted" accessibilityRole="alert">
              Não deu pra carregar os fellas.
            </Text>
            <Button title="Tentar de novo" variant="ghost" onPress={reload} />
          </View>
        ) : (
          <>
            {members.slice(0, MAX_MEMBERS).map((m) => {
              const name = m.display_name || m.username;
              return (
                <Pressable
                  key={m.id}
                  accessibilityRole="link"
                  accessibilityLabel={`Ver perfil de ${name}`}
                  onPress={() => open(m.id)}
                  style={row}
                >
                  <Avatar name={name} uri={resolveUrl(m.avatar_url, avatars)} size={t.avatarSizes.sm} />
                  <View style={{ flex: 1 }}>
                    <Text variant="small" bold numberOfLines={1}>
                      {name}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      @{m.username}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Ver todos os membros"
              onPress={() => router.push('/members')}
              style={row}
            >
              <Text variant="small" style={{ color: t.colors.brand }}>
                Ver todos
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {!loading && !error ? (
        <View style={{ gap: t.spacing.xs }}>
          <Heading level={3}>Aniversários</Heading>
          {birthdays.length === 0 ? (
            <Text variant="small" tone="muted">
              Ninguém pôs o aniversário ainda. Põe o seu em Editar perfil.
            </Text>
          ) : (
            birthdays.map(({ member: m, label }) => {
              const name = m.display_name || m.username;
              return (
                <Pressable
                  key={m.id}
                  accessibilityRole="link"
                  accessibilityLabel={`Aniversário de ${name}: ${label}`}
                  onPress={() => open(m.id)}
                  style={row}
                >
                  <Icon name="gift-outline" size="sm" tone="muted" />
                  <Text variant="small" bold numberOfLines={1} style={{ flex: 1 }}>
                    {name}
                  </Text>
                  <Text variant="small" tone="muted">
                    {label}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}
