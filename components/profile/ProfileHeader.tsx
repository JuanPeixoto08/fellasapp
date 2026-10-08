import { useState, type ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';

import { formatBirthday, type Profile } from '../../lib/api/profiles';
import { memberSince } from '../../lib/format';
import { useTheme } from '../../lib/theme';
import { Avatar, Heading, Icon, Text, UserBadge, type IconName } from '../ui';
import { shownBadge } from '../../lib/badges';
import { PhotoViewer } from '../feed/PhotoViewer';
import { NowPlayingLine } from '../music/NowPlayingLine';

type Props = {
  profile: Profile;
  avatarUri: string | null;
  /** Banner (URL assinada); sem banner, faixa lisa do mesmo tamanho. */
  bannerUri?: string | null;
  /** Botões de ícone à direita, logo abaixo do banner (só no meu perfil). */
  actions?: ReactNode;
  /** Abre a aba Música (toque no "ouvindo agora"); sem isso a linha não aparece. */
  onOpenMusic?: () => void;
};

/** Dia e mês (DD/MM) do aniversário; o ano não é exibido. */
function birthdayDayMonth(iso: string | null | undefined): string | null {
  const full = formatBirthday(iso ?? null);
  return full ? full.slice(0, 5) : null;
}

/**
 * Cabeçalho estilo Twitter: banner 3:1 de ponta a ponta, foto grande com anel da cor do fundo encostada
 * na borda de baixo do banner e ações à direita; nome, status como chip neutro, bio e info logo abaixo.
 * Ocupa a largura toda (o banner encosta nas bordas); o resto tem o gutter da tela. Tocar na foto ou no
 * banner abre a imagem maior (o mesmo visualizador das fotos dos posts).
 */
export function ProfileHeader({ profile, avatarUri, bannerUri, actions, onOpenMusic }: Props) {
  const t = useTheme();
  const badge = shownBadge(profile.badges, profile.featured_badge);
  const name = profile.display_name || profile.username;
  const birthday = birthdayDayMonth(profile.birthday);
  const since = memberSince(profile.created_at);
  const info: { icon: IconName; label: string; text: string }[] = [];
  if (profile.location) info.push({ icon: 'location-outline', label: 'Cidade', text: profile.location });
  if (birthday) info.push({ icon: 'gift-outline', label: 'Aniversário', text: birthday });
  if (since) info.push({ icon: 'calendar-clear-outline', label: 'Membro', text: since });

  const banner = { width: '100%' as const, aspectRatio: t.layout.bannerAspect, backgroundColor: t.colors.surfaceSunken };
  // a foto fica metade em cima do banner: o anel (cor do fundo) separa ela da imagem
  const ringed = t.avatarSizes.xl + t.borders.selected * 2;
  const [viewing, setViewing] = useState<{ uri: string; alt: string } | null>(null);
  const zoomStyle = ({ pressed }: { pressed: boolean }) => ({ cursor: 'pointer' as const, opacity: pressed ? 0.85 : 1 });

  return (
    <View>
      {bannerUri ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver banner de ${name}`}
          onPress={() => setViewing({ uri: bannerUri, alt: `Banner de ${name} (ampliado)` })}
          style={zoomStyle}
        >
          <Image accessibilityLabel={`Banner de ${name}`} source={{ uri: bannerUri }} style={banner} />
        </Pressable>
      ) : (
        <View testID="profile-banner-empty" style={banner} />
      )}
      <View style={{ gap: t.spacing.md, paddingHorizontal: t.layout.gutter, marginTop: -ringed / 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View
            style={{
              borderRadius: t.radii.pill,
              borderWidth: t.borders.selected,
              borderColor: t.colors.bg,
              backgroundColor: t.colors.bg,
            }}
          >
            {avatarUri ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ver foto de ${name}`}
                onPress={() => setViewing({ uri: avatarUri, alt: `Foto de ${name} (ampliada)` })}
                style={zoomStyle}
              >
                <Avatar name={name} uri={avatarUri} size={t.avatarSizes.xl} />
              </Pressable>
            ) : (
              <Avatar name={name} uri={avatarUri} size={t.avatarSizes.xl} />
            )}
          </View>
          {actions ? <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>{actions}</View> : null}
        </View>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
            <Heading level={2} numberOfLines={2} style={{ flexShrink: 1 }}>
              {name}
            </Heading>
            {badge ? <UserBadge badge={badge} size="md" /> : null}
          </View>
          <Text variant="small" tone="muted" numberOfLines={1}>
            @{profile.username}
          </Text>
        </View>
        {profile.lastfm_user && profile.show_now_playing !== false && onOpenMusic ? <NowPlayingLine user={profile.lastfm_user} onPress={onOpenMusic} /> : null}
        {profile.status ? (
          <View
            testID="profile-status"
            style={{
              alignSelf: 'flex-start',
              backgroundColor: t.colors.surfaceSunken,
              borderRadius: t.radii.pill,
              paddingHorizontal: t.spacing.md,
              paddingVertical: t.spacing.xs,
            }}
          >
            <Text variant="small" bold>
              {profile.status}
            </Text>
          </View>
        ) : null}
        {profile.bio ? <Text>{profile.bio}</Text> : null}
        {info.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: t.spacing.lg, rowGap: t.spacing.xs }}>
            {info.map((item) => (
              <View
                key={item.label}
                accessible
                accessibilityLabel={`${item.label}: ${item.text}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}
              >
                <Icon name={item.icon} size="sm" tone="muted" />
                <Text variant="small" tone="muted">
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {viewing ? <PhotoViewer uris={[viewing.uri]} index={0} onClose={() => setViewing(null)} alt={viewing.alt} /> : null}
    </View>
  );
}
