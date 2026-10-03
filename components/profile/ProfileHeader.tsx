import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { Profile } from '../../lib/api/profiles';
import { useTheme } from '../../lib/theme';
import { Avatar, Heading, Text } from '../ui';

type Props = { profile: Profile; avatarUri: string | null; actions?: ReactNode };

export function ProfileHeader({ profile, avatarUri, actions }: Props) {
  const t = useTheme();
  const name = profile.display_name || profile.username;
  return (
    <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingTop: t.spacing.lg }}>
      <Avatar name={name} uri={avatarUri} size={t.layout.minTouch * 2} />
      <Heading level={1} align="center">
        {name}
      </Heading>
      <Text tone="muted">@{profile.username}</Text>
      {profile.bio ? (
        <Text align="center" style={{ marginTop: t.spacing.xs }}>
          {profile.bio}
        </Text>
      ) : null}
      {actions ? <View style={{ marginTop: t.spacing.sm, alignSelf: 'stretch' }}>{actions}</View> : null}
    </View>
  );
}
