import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { useSession } from './SessionProvider';

export type GuardTarget = '/login' | '/not-invited' | '/feed' | null;

export function resolveGuardTarget(
  hasSession: boolean,
  isMember: boolean,
  first: string | undefined,
): GuardTarget {
  if (!hasSession) return first === '(auth)' ? null : '/login';
  if (!isMember) return first === 'not-invited' ? null : '/not-invited';
  return first === '(auth)' || first === 'not-invited' ? '/feed' : null;
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const first = segments[0] as string | undefined;

  const target = loading ? null : resolveGuardTarget(!!session, !!profile?.is_member, first);

  useEffect(() => {
    if (target) router.replace(target as never);
  }, [target, router]);

  return (
    <>
      {children}
      {loading ? (
        <View style={styles.overlay}>
          <ActivityIndicator />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
