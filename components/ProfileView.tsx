import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getProfile,
  getSignedUrl,
  listPostsByUser,
  type Post,
  type Profile,
} from '../lib/api/profiles';
import { useTheme } from '../lib/theme';
import { PostTile } from './profile/PostTile';
import { ProfileHeader } from './profile/ProfileHeader';
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
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, ps] = await Promise.all([getProfile(userId), listPostsByUser(userId)]);
      setProfile(p);
      setPosts(ps);
      setAvatar(await getSignedUrl(p.avatar_url));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar perfil');
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
        <ProfileHeader profile={profile} avatarUri={avatar} actions={actions} />
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
              {posts.map((post) => (
                <PostTile key={post.id} post={post} size={tile} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
