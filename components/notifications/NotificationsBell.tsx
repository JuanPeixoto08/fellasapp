import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { notificationsLabel } from '../../lib/notifications';
import { useUnreadNotifications } from '../../lib/notificationsStore';
import { Badge, IconButton } from '../ui';

/** Sino do topo do feed no celular (como o coração do Instagram), com a bolinha de não lidas. */
export function NotificationsBell() {
  const router = useRouter();
  const count = useUnreadNotifications();
  return (
    <View>
      <IconButton
        icon="notifications-outline"
        variant="ghost"
        size="lg"
        accessibilityLabel={notificationsLabel(count)}
        onPress={() => router.push('/notifications')}
      />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0 }}>
        <Badge count={count} />
      </View>
    </View>
  );
}
