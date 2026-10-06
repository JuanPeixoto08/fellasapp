import type { Session } from '@supabase/supabase-js';

import type { Profile } from '../api/auth';

// Dev-only: EXPO_PUBLIC_DEV_FAKE_LOGIN=1 in .env skips the login screen with a fake member, so the
// app's screens can be browsed without a Supabase project. Never active in production builds.
export const DEV_FAKE_LOGIN = __DEV__ && process.env.EXPO_PUBLIC_DEV_FAKE_LOGIN === '1';

const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';
const FAKE_EMAIL = 'teste@fellas.dev';

export const fakeSession = {
  access_token: 'dev-fake-token',
  refresh_token: 'dev-fake-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  user: {
    id: FAKE_USER_ID,
    email: FAKE_EMAIL,
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: { has_password: true },
    created_at: new Date(0).toISOString(),
  },
} as Session;

export const fakeProfile: Profile = {
  id: FAKE_USER_ID,
  username: 'teste',
  display_name: 'Teste Fella',
  avatar_url: null,
  bio: 'Usuário falso do modo dev (EXPO_PUBLIC_DEV_FAKE_LOGIN).',
  status: null,
  location: null,
  birthday: null,
  is_member: true,
  is_admin: false,
  created_at: new Date(0).toISOString(),
  notifications_seen_at: new Date(0).toISOString(),
};
