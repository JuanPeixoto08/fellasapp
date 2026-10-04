import { usePathname, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '../../lib/auth/SessionProvider';
import type { LayoutTier } from '../../lib/layout';
import { useTheme } from '../../lib/theme';
import { useMyAvatar } from '../../lib/useMyAvatar';
import { Avatar, Button, Icon, IconButton, interactiveStyle, Logo, Text, type IconName } from '../ui';

export type NavKey = 'feed' | 'profile' | 'members';

const ITEMS: { key: NavKey; label: string; href: '/feed' | '/profile' | '/members'; icon: IconName; iconActive: IconName }[] = [
  { key: 'feed', label: 'Feed', href: '/feed', icon: 'newspaper-outline', iconActive: 'newspaper' },
  { key: 'profile', label: 'Perfil', href: '/profile', icon: 'person-outline', iconActive: 'person' },
  { key: 'members', label: 'Membros', href: '/members', icon: 'people-outline', iconActive: 'people' },
];

/** Item ativo pela rota exata; rotas filhas (post, perfil de outro, editar) não marcam nada. */
export function activeNavItem(pathname: string): NavKey | null {
  if (pathname === '/' || pathname === '/feed') return 'feed';
  if (pathname === '/profile') return 'profile';
  if (pathname === '/members') return 'members';
  return null;
}

type Props = { tier: Exclude<LayoutTier, 'compact'>; onCompose: () => void };

/** Barra lateral do desktop: logo, Feed/Perfil/Membros, Postar e eu no pé. */
export function Sidebar({ tier, onCompose }: Props) {
  const t = useTheme();
  const router = useRouter();
  const active = activeNavItem(usePathname());
  const me = useMyAvatar();
  const { profile } = useSession();
  const expanded = tier === 'expanded';
  // iPad/tablet: a lateral vai do topo ao pé da tela, então desvia da barra de status e do indicador de home
  const insets = useSafeAreaInsets();

  return (
    <View
      role="navigation"
      accessibilityLabel="Navegação"
      style={{
        width: t.layout.sidebarWidth[tier],
        paddingHorizontal: expanded ? t.spacing.md : t.spacing.sm,
        paddingTop: insets.top + t.spacing.lg,
        paddingBottom: insets.bottom + t.spacing.lg,
        gap: t.spacing.xs,
        alignItems: expanded ? 'stretch' : 'center',
      }}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Ir para o feed"
        onPress={() => router.navigate('/feed')}
        style={(state) => ({
          minHeight: t.layout.minTouch,
          justifyContent: 'center',
          paddingHorizontal: expanded ? t.spacing.md : t.spacing.xs,
          borderRadius: t.radii.pill,
          marginBottom: t.spacing.sm,
          ...interactiveStyle(t, state),
        })}
      >
        <Logo height={expanded ? t.layout.logoHeight.sm : t.layout.logoHeight.xs} />
      </Pressable>

      {ITEMS.map((item) => {
        const on = active === item.key;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="link"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: on }}
            onPress={() => router.navigate(item.href)}
            style={(state) => ({
              minHeight: t.layout.minTouch,
              minWidth: t.layout.minTouch,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: expanded ? 'flex-start' : 'center',
              gap: t.spacing.md,
              paddingHorizontal: expanded ? t.spacing.md : 0,
              borderRadius: t.radii.pill,
              ...interactiveStyle(t, state),
            })}
          >
            <Icon name={on ? item.iconActive : item.icon} size="lg" color={on ? t.colors.brand : undefined} />
            {expanded ? (
              <Text variant="lead" bold={on} style={on ? { color: t.colors.brand } : undefined}>
                {item.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}

      <View style={{ marginTop: t.spacing.md }}>
        {expanded ? (
          <Button title="Postar" onPress={onCompose} fullWidth />
        ) : (
          <IconButton icon="add" variant="solid" accessibilityLabel="Postar" onPress={onCompose} />
        )}
      </View>

      <View style={{ flex: 1 }} />

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Meu perfil"
        onPress={() => router.navigate('/profile')}
        style={(state) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: expanded ? 'flex-start' : 'center',
          gap: t.spacing.md,
          padding: t.spacing.sm,
          borderRadius: t.radii.pill,
          ...interactiveStyle(t, state),
        })}
      >
        <Avatar name={me.name} uri={me.uri} size={t.avatarSizes.md} />
        {expanded ? (
          <View style={{ flex: 1 }}>
            <Text bold numberOfLines={1}>
              {me.name}
            </Text>
            {profile?.username ? (
              <Text variant="small" tone="muted" numberOfLines={1}>
                @{profile.username}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
