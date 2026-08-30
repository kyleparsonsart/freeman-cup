import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Session as AuthSession } from '@supabase/supabase-js';

/**
 * Real auth: magic-link email carrying a six-digit code, entered in the
 * app. The code path matters on iOS — a standalone PWA has its own
 * storage container, so a link tapped in Mail signs in Safari, not the
 * app. Typing the code inside the icon-launched app avoids that trap.
 */
export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /** Send the sign-in email. Seats are invited, never self-registered. */
  const sendCode = useCallback(async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    });
    if (!error) return null;
    return /not allowed|not found|signups/i.test(error.message)
      ? "That email isn't on the invite list. Check with the commissioner."
      : error.message;
  }, []);

  const verifyCode = useCallback(async (email: string, code: string): Promise<string | null> => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (!error) return null;
    return /invalid|expired/i.test(error.message)
      ? "That code didn't match, or it expired. Try again or request a new one."
      : error.message;
  }, []);

  /** Local dev only: the seed's test users sign in by password. */
  const devSignIn = useCallback(async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: 'testpass123!' });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { session, ready, sendCode, verifyCode, devSignIn, signOut };
}
