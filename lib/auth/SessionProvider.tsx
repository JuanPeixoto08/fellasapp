import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import * as authApi from '../api/auth';
import type { Profile } from '../api/auth';
import { useClearDraftOnUserChange } from '../composerDraft';
import { DEV_FAKE_LOGIN, fakeProfile, fakeSession } from './devFakeLogin';

type SessionContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  if (DEV_FAKE_LOGIN) return <FakeSessionProvider>{children}</FakeSessionProvider>;
  return <RealSessionProvider>{children}</RealSessionProvider>;
}

function FakeSessionProvider({ children }: { children: ReactNode }) {
  const value = useMemo(
    () => ({ session: fakeSession, profile: fakeProfile, loading: false, signOut: async () => {} }),
    [],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function RealSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileFor, setProfileFor] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authApi
      .getSession()
      .then((s) => {
        if (active) setSession((prev) => prev ?? s);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSessionReady(true);
      });
    const sub = authApi.onAuthChange((s) => {
      setSession(s);
      setSessionReady(true);
    });
    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;
  useClearDraftOnUserChange(userId);
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileFor(null);
      return;
    }
    let active = true;
    authApi
      .fetchProfile(userId)
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setProfileFor(userId);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const signOut = useCallback(async () => {
    await authApi.signOut();
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile,
      loading: !sessionReady || (!!userId && profileFor !== userId),
      signOut,
    }),
    [session, profile, sessionReady, profileFor, userId, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession deve ser usado dentro de <SessionProvider>');
  return ctx;
}
