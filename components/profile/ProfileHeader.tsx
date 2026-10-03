import type { ReactNode } from 'react';
import { View } from 'react-native';

import { formatBirthday, type Profile } from '../../lib/api/profiles';
import { profileColor, useTheme } from '../../lib/theme';
import { Avatar, Heading, Text } from '../ui';

type Props = { profile: Profile; avatarUri: string | null; actions?: ReactNode };

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function memberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `membro desde ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Dia e mês (DD/MM) do aniversário; o ano não é exibido. */
function birthdayDayMonth(iso: string | null | undefined): string | null {
  const full = formatBirthday(iso ?? null);
  return full ? full.slice(0, 5) : null;
}

export function ProfileHeader({ profile, avatarUri, actions }: Props) {
  const t = useTheme();
  const color = profileColor(profile.id, profile.accent_color);
  const name = profile.display_name || profile.username;
  const avatarSize = t.layout.minTouch * 2;
  const ring = t.spacing.xs;
  const info = [
    profile.location ? `📍 ${profile.location}` : null,
    birthdayDayMonth(profile.birthday) ? `🎂 ${birthdayDayMonth(profile.birthday)}` : null,
    memberSince(profile.created_at),
  ].filter((x): x is string => !!x);

  return (
    <View style={{ gap: t.spacing.sm }}>
      <View
        testID="profile-banner"
        style={{
          height: t.layout.minTouch * 2.5,
          backgroundColor: color.bg,
          borderRadius: t.radii.lg,
        }}
      />
      <View style={{ alignItems: 'center', gap: t.spacing.sm, marginTop: -(avatarSize / 2 + ring) }}>
        <View
          testID="profile-avatar-ring"
          style={{
            padding: ring,
            borderRadius: 999,
            backgroundColor: color.bg,
            borderWidth: ring,
            borderColor: t.colors.bg,
          }}
        >
          <Avatar name={name} uri={avatarUri} size={avatarSize} />
        </View>
        <Heading level={1} align="center">
          {name}
        </Heading>
        <Text tone="muted">@{profile.username}</Text>
        {profile.status ? (
          <View
            testID="profile-status"
            style={{
              backgroundColor: color.bg,
              borderRadius: t.radii.pill,
              paddingHorizontal: t.spacing.md,
              paddingVertical: t.spacing.xs,
            }}
          >
            <Text variant="small" style={{ color: color.ink }}>
              {profile.status}
            </Text>
          </View>
        ) : null}
        {profile.bio ? (
          <Text align="center" style={{ marginTop: t.spacing.xs }}>
            {profile.bio}
          </Text>
        ) : null}
        {info.length > 0 ? (
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: t.spacing.md }}
          >
            {info.map((line) => (
              <Text key={line} variant="small" tone="muted">
                {line}
              </Text>
            ))}
          </View>
        ) : null}
        {actions ? <View style={{ marginTop: t.spacing.sm, alignSelf: 'stretch' }}>{actions}</View> : null}
      </View>
    </View>
  );
}
