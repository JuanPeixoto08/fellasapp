// Mesma origem do app (fellasapp.pages.dev): o storage padrão (localStorage) já tem a sessão que o app gravou,
// então o fella entra na mesa sem novo login e sem token na URL.
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.EXPO_PUBLIC_SUPABASE_URL,
  import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
);
