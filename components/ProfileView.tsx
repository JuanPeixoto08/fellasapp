import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FeedPost } from '../lib/api/posts';
import { getProfile, setPinnedPost, type Profile } from '../lib/api/profiles';
import { getProfileStats, type ProfileStats as Stats } from '../lib/api/profileStats';
import { resolveUrl, signPaths } from '../lib/api/storage';
import { useSession } from '../lib/auth/SessionProvider';
import { friendlyError } from '../lib/errors';
import { onPostDeleted } from '../lib/postEvents';
import { useTheme } from '../lib/theme';
import { removePost, usePostList } from '../lib/usePostList';
import { MusicTab } from './music/MusicTab';
import { PostCard } from './PostCard';
import { useContentWidth } from './shell/ShellContext';
import { PostTile } from './profile/PostTile';
import { ProfileHeader } from './profile/ProfileHeader';
import { ProfileStats } from './profile/ProfileStats';
import { Divider, EmptyState, Tabs, Text } from './ui';

type Props = {
  userId: string;
  /** Botões de ícone (editar, membros) exibidos apenas no meu perfil. */
  actions?: ReactNode;
  /** A tela tem cabeçalho de navegação (perfil de outro fella): não soma a área segura do topo. */
  header?: boolean;
  /** O perfil chegou (ex.: a tela põe o @ da pessoa no título). */
  onLoaded?: (profile: Profile) => void;
};

export type ProfileTab = 'posts' | 'photos' | 'music';

/** O que a apresentação precisa de uma lista de posts (o `usePostList` entrega isso). */
export type PostListView = {
  posts: FeedPost[];
  loaded: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
  reload: () => void;
  loadMore: () => void;
  like: (post: FeedPost) => void;
  react: (post: FeedPost, emoji: string | null) => void;
};

const COLUMNS = 3;

export default function ProfileView({ userId, actions, header, onLoaded }: Props) {
  const t = useTheme();
  const router = useRouter();
  const isMe = useSession().session?.user.id === userId;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProfileTab>('posts');
  const [pinError, setPinError] = useState<string | null>(null);
  const pinnedId = profile?.pinned_post_id ?? undefined;
  const posts = usePostList({ authorId: userId, pinnedId });
  const photos = usePostList({ authorId: userId, photosOnly: true, enabled: tab === 'photos' });

  const load = useCallback(async () => {
    try {
      const p = await getProfile(userId);
      // avatar e estatísticas são extras: se falharem, o resto do perfil continua
      const [signed, st] = await Promise.all([
        signPaths([p.avatar_url, p.banner_url]).catch(() => new Map<string, string>()),
        getProfileStats(userId).catch(() => null),
      ]);
      setProfile(p);
      onLoaded?.(p);
      setAvatarUri(resolveUrl(p.avatar_url, signed));
      setBannerUri(resolveUrl(p.banner_url, signed));
      setStats(st);
      setError(null);
    } catch (e) {
      setError(friendlyError(e, 'Pode ter sido a conexão. Tenta de novo daqui a pouco.'));
    } finally {
      setLoading(false);
    }
  }, [userId, onLoaded]);

  // ao ganhar foco (ex.: voltando de "Editar perfil") o cabeçalho e os números se atualizam;
  // a lista fica como está, com a aba e a rolagem
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // apagou um post: os números mudam
  useEffect(
    () =>
      onPostDeleted(() => {
        getProfileStats(userId)
          .then(setStats)
          .catch(() => {});
      }),
    [userId],
  );

  // um fixado por pessoa: fixar outro troca; tocar no fixado desafixa
  const togglePin = async (post: FeedPost) => {
    const next = profile?.pinned_post_id === post.id ? null : post.id;
    setPinError(null);
    try {
      await setPinnedPost(next);
      setProfile((cur) => (cur ? { ...cur, pinned_post_id: next } : cur));
    } catch (e) {
      setPinError(friendlyError(e, 'Não deu pra fixar. Tenta de novo.'));
    }
  };

  // tirou o Last.fm (ou o perfil chegou sem): a aba Música some, volta para Posts
  useEffect(() => {
    if (tab === 'music' && profile && !profile.lastfm_user) setTab('posts');
  }, [tab, profile]);

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
      <SafeAreaView edges={header ? [] : ['top']} style={[frame, { justifyContent: 'center' }]}>
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

  const current = tab === 'posts' ? posts : photos;

  return (
    <ProfileContent
      profile={profile}
      avatarUri={avatarUri}
      bannerUri={bannerUri}
      stats={stats}
      actions={actions}
      isMe={isMe}
      header={header}
      tab={tab}
      onTabChange={setTab}
      list={{
        ...current,
        refresh: () => {
          current.refresh();
          load();
        },
      }}
      onOpenPost={(p) => router.push(`/post/${p.id}`)}
      onNewPost={() => router.navigate('/new')}
      onDelete={isMe ? (p) => removePost(p.id) : undefined}
      lastfmUser={profile.lastfm_user}
      pinnedId={pinnedId}
      onTogglePin={isMe ? (p) => void togglePin(p) : undefined}
      pinError={pinError}
    />
  );
}

type ContentProps = {
  profile: Profile;
  avatarUri: string | null;
  bannerUri?: string | null;
  stats: Stats | Pick<Stats, 'posts' | 'likesReceived' | 'commentsReceived'> | null;
  actions?: ReactNode;
  isMe: boolean;
  header?: boolean;
  tab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  /** Lista da aba atual. */
  list: PostListView;
  onOpenPost: (post: FeedPost) => void;
  onNewPost?: () => void;
  onDelete?: (post: FeedPost) => Promise<void>;
  /** Usuário do Last.fm: aba Música e "ouvindo agora". */
  lastfmUser?: string | null;
  /** Post fixado no topo da aba Posts. */
  pinnedId?: string | null;
  /** Só no meu perfil: alfinete nos posts. */
  onTogglePin?: (post: FeedPost) => void;
  pinError?: string | null;
};

/** Apresentação do perfil (sem busca de dados): cabeçalho, números, abas Posts/Fotos e a lista. */
export function ProfileContent({
  profile,
  avatarUri,
  bannerUri,
  stats,
  actions,
  isMe,
  header,
  tab,
  onTabChange,
  list,
  onOpenPost,
  onNewPost,
  onDelete,
  lastfmUser,
  pinnedId,
  onTogglePin,
  pinError,
}: ContentProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const contentWidth = useContentWidth();
  const name = profile.display_name || profile.username;
  const photosTab = tab === 'photos';
  const content = contentWidth - t.layout.gutter * 2;
  const tile = Math.floor((content - t.spacing.xs * (COLUMNS - 1)) / COLUMNS);

  const empty = (() => {
    if (!list.loaded || list.loading) {
      return (
        <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando posts" />
      );
    }
    if (list.error) {
      return (
        <EmptyState
          title={photosTab ? 'As fotos não carregaram' : 'Os posts não carregaram'}
          message="Deu ruim na conexão. Confere a internet e tenta de novo."
          actionLabel="Tentar de novo"
          onAction={list.reload}
        />
      );
    }
    if (photosTab) {
      return (
        <EmptyState
          title="Nenhuma foto ainda"
          message={isMe ? 'As fotos que você postar aparecem aqui.' : `Quando ${name} postar uma foto, ela aparece aqui.`}
        />
      );
    }
    return isMe ? (
      <EmptyState
        title="Você ainda não postou"
        message="Solta a primeira foto ou frase pro grupo."
        actionLabel={onNewPost ? 'Bora postar' : undefined}
        onAction={onNewPost}
      />
    ) : (
      <EmptyState title={`${name} ainda não postou`} message="Quando rolar, aparece aqui." />
    );
  })();

  const top = (
    <View style={{ gap: t.spacing.lg, marginBottom: photosTab ? t.spacing.sm : 0 }}>
      <ProfileHeader
        profile={profile}
        avatarUri={avatarUri}
        bannerUri={bannerUri}
        actions={actions}
        onOpenMusic={lastfmUser ? () => onTabChange('music') : undefined}
      />
      {stats ? (
        <View style={{ paddingHorizontal: t.layout.gutter }}>
          <ProfileStats stats={stats} />
        </View>
      ) : null}
      <Tabs
        items={[
          { key: 'posts', label: 'Posts' },
          { key: 'photos', label: 'Fotos' },
          ...(lastfmUser ? [{ key: 'music' as const, label: 'Música' }] : []),
        ]}
        value={tab}
        onChange={onTabChange}
      />
      {pinError ? (
        <Text variant="small" tone="danger" accessibilityRole="alert" style={{ paddingHorizontal: t.layout.gutter }}>
          {pinError}
        </Text>
      ) : null}
    </View>
  );

  if (tab === 'music' && lastfmUser) {
    return (
      <SafeAreaView edges={header ? ['left', 'right'] : ['top', 'left', 'right']} style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <MusicTab user={lastfmUser} top={top} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={header ? ['left', 'right'] : ['top', 'left', 'right']} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <FlatList
        key={tab}
        data={list.posts}
        keyExtractor={(p) => p.id}
        numColumns={photosTab ? COLUMNS : 1}
        columnWrapperStyle={photosTab ? { gap: t.spacing.xs, paddingHorizontal: t.layout.gutter } : undefined}
        ItemSeparatorComponent={photosTab ? undefined : Divider}
        contentContainerStyle={{
          width: '100%',
          maxWidth: t.layout.maxContentWidth,
          alignSelf: 'center',
          paddingBottom: t.spacing.xxl + insets.bottom,
          gap: photosTab ? t.spacing.xs : 0,
        }}
        ListHeaderComponent={top}
        renderItem={({ item }) =>
          photosTab ? (
            <PostTile post={item} size={tile} onPress={onOpenPost} />
          ) : (
            <PostCard
              post={item}
              onToggleLike={list.like}
              onReact={list.react}
              onPress={onOpenPost}
              onDelete={onDelete}
              linkAuthor={false}
              pinned={item.id === pinnedId}
              onTogglePin={onTogglePin}
            />
          )
        }
        ListEmptyComponent={empty}
        ListFooterComponent={
          list.posts.length > 0 && list.loading && !list.refreshing ? (
            <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando mais" />
          ) : null
        }
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
      />
    </SafeAreaView>
  );
}
