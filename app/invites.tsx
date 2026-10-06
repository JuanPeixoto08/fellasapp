import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stackHeader } from '../components/profile/headerOptions';
import { Button, Divider, EmptyState, Heading, Icon, IconButton, Screen, Text, type IconName } from '../components/ui';
import {
  createInviteLink,
  inviteErrorMessage,
  inviteStatus,
  inviteUrl,
  listInviteLinks,
  shareInvite,
  type InviteLink,
  type InviteStatus,
} from '../lib/api/invites';
import { useSession } from '../lib/auth/SessionProvider';
import { postTime, shortDate } from '../lib/format';
import { useTheme } from '../lib/theme';

const COPIED_MS = 2000;
const shareLabel = Platform.OS === 'web' ? 'Copiar link' : 'Compartilhar link';

export default function InvitesScreen() {
  const t = useTheme();
  const { profile } = useSession();

  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Convidar')} />
      <Screen header>
        {profile?.is_admin ? (
          <InviteManager />
        ) : (
          <EmptyState title="Só o admin convida" message="Quer trazer alguém pro grupo? Fala com quem cuida do fellas." />
        )}
      </Screen>
    </>
  );
}

/** "Copiado!" por um instante depois de copiar no web; no celular a folha do sistema já dá o retorno. */
function useShare() {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(id);
  }, [copied]);
  const share = useCallback(async (token: string) => {
    const result = await shareInvite(inviteUrl(token)).catch(() => null);
    if (result === 'copied') setCopied(token);
  }, []);
  return { copied, share };
}

function InviteManager() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copied, share } = useShare();

  const load = useCallback(async () => {
    try {
      setLinks(await listInviteLinks());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      setFresh(await createInviteLink());
      void load();
    } catch (e) {
      setError(inviteErrorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  const header = (
    <View style={{ gap: t.spacing.lg, paddingTop: t.spacing.lg, paddingBottom: t.spacing.xl }}>
      <Text tone="muted">
        Gera um link e manda pra pessoa. Ele vale pra uma pessoa só, por 7 dias: ela põe o email, recebe o código
        e cria a senha.
      </Text>
      <Button title="Gerar link de convite" onPress={() => void create()} loading={creating} fullWidth />
      {error ? (
        <Text variant="small" tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {fresh ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            gap: t.spacing.md,
            padding: t.spacing.lg,
            borderRadius: t.radii.lg,
            borderWidth: t.borders.hairline,
            borderColor: t.colors.border,
            backgroundColor: t.colors.surface,
          }}
        >
          <Text variant="small" bold>
            Link novo
          </Text>
          <Text selectable>{inviteUrl(fresh)}</Text>
          <Button
            title={copied === fresh ? 'Copiado!' : shareLabel}
            accessibilityLabel={shareLabel}
            variant="secondary"
            onPress={() => void share(fresh)}
            fullWidth
          />
        </View>
      ) : null}
      <Heading level={3} style={{ marginTop: t.spacing.lg }}>
        Links
      </Heading>
    </View>
  );

  let empty;
  if (loading) {
    empty = <ActivityIndicator color={t.colors.primary} style={{ paddingVertical: t.spacing.xl }} />;
  } else if (loadError) {
    empty = (
      <View style={{ gap: t.spacing.sm, alignItems: 'flex-start' }}>
        <Text tone="muted">Não deu pra carregar os links.</Text>
        <Button title="Tentar de novo" variant="secondary" onPress={() => void load()} />
      </View>
    );
  } else {
    empty = <Text tone="muted">Nenhum link ainda. Gera o primeiro aí em cima.</Text>;
  }

  return (
    <FlatList
      data={loading || loadError ? [] : links}
      keyExtractor={(l) => l.token}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ItemSeparatorComponent={Divider}
      contentContainerStyle={{ paddingBottom: t.spacing.lg + insets.bottom }}
      renderItem={({ item }) => (
        <InviteRow link={item} copied={copied === item.token} onShare={() => void share(item.token)} />
      )}
    />
  );
}

const ROW: Record<InviteStatus, { icon: IconName; title: (l: InviteLink) => string; detail: (l: InviteLink) => string }> = {
  used: {
    icon: 'checkmark-circle-outline',
    title: (l) => `Usado por ${l.usedEmail ?? 'alguém'}`,
    detail: (l) => (l.usedAt ? postTime(l.usedAt) : ''),
  },
  open: {
    icon: 'link-outline',
    title: () => 'Link ainda não usado',
    detail: (l) => `vale até ${shortDate(l.expiresAt)}`,
  },
  expired: {
    icon: 'time-outline',
    title: () => 'Link vencido',
    detail: (l) => `venceu em ${shortDate(l.expiresAt)}`,
  },
};

function InviteRow({ link, copied, onShare }: { link: InviteLink; copied: boolean; onShare: () => void }) {
  const t = useTheme();
  const status = inviteStatus(link);
  const row = ROW[status];
  const title = row.title(link);
  const detail = row.detail(link);
  return (
    <View
      style={{
        minHeight: t.layout.minTouch + t.spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        paddingVertical: t.spacing.sm,
      }}
    >
      <View accessible accessibilityLabel={`${title}, ${detail}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <Icon name={row.icon} size="lg" color={status === 'used' ? t.colors.success : t.colors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text bold numberOfLines={1} tone={status === 'expired' ? 'muted' : 'default'}>
            {title}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {copied ? 'Copiado!' : detail}
          </Text>
        </View>
      </View>
      {status === 'open' ? (
        <IconButton
          icon={Platform.OS === 'web' ? 'copy-outline' : 'share-outline'}
          variant="ghost"
          accessibilityLabel={shareLabel}
          onPress={onShare}
        />
      ) : null}
    </View>
  );
}
