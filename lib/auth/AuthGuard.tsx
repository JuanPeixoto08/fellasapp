import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { Logo } from '../../components/ui';
import { useTheme } from '../theme';
import { hasPassword } from '../api/auth';
import { usePasswordResetPending } from './passwordReset';
import { useSession } from './SessionProvider';

export type GuardTarget = '/login' | '/not-invited' | '/feed' | '/set-password' | null;

/**
 * Para onde mandar a pessoa. `needsPassword`: membro que ainda não criou senha (ou que está redefinindo
 * pelo "esqueci a senha") fica preso em /set-password até salvar uma.
 */
export function resolveGuardTarget(
  hasSession: boolean,
  isMember: boolean,
  first: string | undefined,
  needsPassword = false,
): GuardTarget {
  if (!hasSession) return first === '(auth)' ? null : '/login';
  if (!isMember) return first === 'not-invited' ? null : '/not-invited';
  if (needsPassword) return first === 'set-password' ? null : '/set-password';
  return first === '(auth)' || first === 'not-invited' ? '/feed' : null;
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const t = useTheme();
  const first = segments[0] as string | undefined;

  const resetting = usePasswordResetPending();
  const needsPassword = !hasPassword(session) || resetting;
  const target = loading ? null : resolveGuardTarget(!!session, !!profile?.is_member, first, needsPassword);

  useEffect(() => {
    if (target) router.replace(target as never);
  }, [target, router]);

  return (
    <>
      {children}
      {loading ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Carregando"
          style={[
            StyleSheet.absoluteFill,
            {
              alignItems: 'center',
              justifyContent: 'center',
              gap: t.spacing.lg,
              backgroundColor: t.colors.bg,
            },
          ]}
        >
          <Logo height={t.layout.logoHeight.lg} />
          <ActivityIndicator color={t.colors.primary} />
        </View>
      ) : null}
    </>
  );
}
