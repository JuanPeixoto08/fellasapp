import type { ReactNode } from 'react';
import { View } from 'react-native';

import { formatBirthday, type Profile } from '../../lib/api/profiles';
import { memberSince } from '../../lib/format';
import { profileColor, useTheme } from '../../lib/theme';
import { Avatar, Heading, Icon, Text, type IconName } from '../ui';

type Props = {
  profile: Profile;
  avatarUri: string | null;
  /** Botões de ícone à direita do nome (só no meu perfil). */
  actions?: ReactNode;
};

/** Dia e mês (DD/MM) do aniversário; o ano não é exibido. */
function birthdayDayMonth(iso: string | null | undefined): string | null {
  const full = formatBirthday(iso ?? null);
  return full ? full.slice(0, 5) : null;
}

/**
 * Cabeçalho compacto: avatar com anel na cor do fella, nome e ações numa linha; status como chip
 * na mesma cor (o único gesto de cor da página), bio e info logo abaixo.
 */
export function ProfileHeader({ profile, avatarUri, actions }: Props) {
  const t = useTheme();
  const color = profileColor(profile.id, profile.accent_color);
  const name = profile.display_name || profile.username;
  const birthday = birthdayDayMonth(profile.birthday);
  const since = memberSince(profile.created_at);
  const info: { icon: IconName; label: string; text: string }[] = [];
  if (profile.location) info.push({ icon: 'location-outline', label: 'Cidade', text: profile.location });
  if (birthday) info.push({ icon: 'gift-outline', label: 'Aniversário', text: birthday });
  if (since) info.push({ icon: 'calendar-clear-outline', label: 'Membro', text: since });

  return (
    <View style={{ gap: t.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <View
          testID="profile-avatar-ring"
          style={{
            padding: t.borders.selected,
            borderRadius: t.radii.pill,
            borderWidth: t.borders.selected,
            borderColor: color.bg,
          }}
        >
          <Avatar name={name} uri={avatarUri} size={t.avatarSizes.lg} />
        </View>
        <View style={{ flex: 1 }}>
          <Heading level={2} numberOfLines={2}>
            {name}
          </Heading>
          <Text variant="small" tone="muted" numberOfLines={1}>
            @{profile.username}
          </Text>
        </View>
        {actions ? <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>{actions}</View> : null}
      </View>
      {profile.status ? (
        <View
          testID="profile-status"
          style={{
            alignSelf: 'flex-start',
            backgroundColor: color.bg,
            borderRadius: t.radii.pill,
            paddingHorizontal: t.spacing.md,
            paddingVertical: t.spacing.xs,
          }}
        >
          <Text variant="small" bold style={{ color: color.ink }}>
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
  );
}
