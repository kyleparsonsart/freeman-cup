import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** Auto-sign-in as Kyle P. (hard-coded until auth is built) */
let _authReady: Promise<void> | null = null;
export function ensureAuth(): Promise<void> {
  if (_authReady) return _authReady;
  _authReady = (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return;
    const { error } = await supabase.auth.signInWithPassword({
      email: 'kyle@example.com',
      password: 'testpass123!',
    });
    if (error) console.error('Auto-sign-in failed:', error.message);
  })();
  return _authReady;
}
