/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Supabase project URL (Dashboard → Project Settings → API → Project URL).
   * Public in the bundle — fine for URL; do not put secret keys in any `VITE_*` name.
   */
  readonly VITE_SUPABASE_URL?: string;
  /**
   * Supabase **anon** public key only. Browser-safe **with RLS**; never use the
   * server-only Supabase credential that bypasses RLS (see `npm run verify:public-env` in backend).
   */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

