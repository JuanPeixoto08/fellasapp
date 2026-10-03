import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getProfile, listPostsByUser, type Post, type Profile } from '../lib/api/profiles';
import { getProfileStats, type ProfileStats as Stats } from '../lib/api/profileStats';
import { resolveUrl, signPaths } from '../lib/api/storage';
import { friendlyError } from '../lib/errors';
import { profileColor, useTheme } from '../lib/theme';
import { PostTile } from './profile/PostTile';
import { ProfileHeader } from './profile/ProfileHeader';
import { ProfileStats } from './profile/ProfileStats';
import { Divider, EmptyState, Heading, Text } from './ui';

type Props = {
  userId: string;
  /** Botões (Editar/Sair) exibidos apenas no meu perfil. */
  actions?: React.ReactNode;
};

const COLUMNS = 3;

export default function ProfileView({ userId, actions }: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [signed, setSigned] = useState<Map<string, string>>(new Map());
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, ps] = await Promise.all([getProfile(userId), listPostsByUser(userId)]);
      // avatar + fotos do grid numa assinatura só; estatísticas são um extra e podem falhar sozinhas
      const [urls, st] = await Promise.all([
        signPaths([p.avatar_url, ...ps.map((post) => post.image_url)]).catch(() => new Map<string, string>()),
        getProfileStats(userId).catch(() => null),
      ]);
      setProfile(p);
      setPosts(ps);
      setSigned(urls);
      setStats(st);
      setError(null);
    } catch (e) {
      setError(friendlyError(e, 'Pode ter sido a conexão. Tenta de novo daqui a pouco.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const frame = { flex: 1, backgroundColor: t.colors.bg } as const;

  if (loading) {
    return (
      <View style={[frame, { alignItems: 'center', justifyContent: 'center', gap: t.spacing.md }]}>
        <ActivityIndicator color={t.colors.primary} />
        <Text tone="muted">Carregando o perfil…</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView edges={['top']} style={[frame, { justifyContent: 'center' }]}>
        <EmptyState
          title="Não achamos esse perfil"
          message={error ?? 'Perfil não encontrado'}
          actionLabel="Tentar de novo"
          onAction={() => {
            setLoading(true);
            load();
          }}
        />
      </SafeAreaView>
    );
  }

  const color = profileColor(profile.id, profile.accent_color);
  const content = Math.min(width, t.layout.maxContentWidth) - t.layout.gutter * 2;
  const tile = Math.floor((content - t.spacing.sm * (COLUMNS - 1)) / COLUMNS);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={frame}>
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          maxWidth: t.layout.maxContentWidth,
          alignSelf: 'center',
          paddingHorizontal: t.layout.gutter,
          paddingBottom: t.spacing.xxl + insets.bottom,
          gap: t.spacing.xl,
        }}
      >
        <ProfileHeader profile={profile} avatarUri={resolveUrl(profile.avatar_url, signed)} actions={actions} />
        {stats ? <ProfileStats stats={stats} color={color} /> : null}
        <Divider />
        <View style={{ gap: t.spacing.md }}>
          <Heading level={2}>
            Posts{' '}
            <Text variant="title" tone="muted">
              {posts.length}
            </Text>
          </Heading>
          {posts.length === 0 ? (
            <EmptyState
              title="Nada por aqui ainda"
              message="Quando rolar o primeiro post, ele aparece aqui."
            />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {posts.map((post, i) => (
                <PostTile
                  key={post.id}
                  post={post}
                  imageUri={resolveUrl(post.image_url, signed)}
                  size={tile}
                  tone={i}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
