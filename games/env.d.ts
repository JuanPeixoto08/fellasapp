interface ImportMetaEnv {
  readonly EXPO_PUBLIC_SUPABASE_URL: string;
  readonly EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
}
declare module '*.sql?raw' {
  const sql: string;
  export default sql;
}
