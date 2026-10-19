// Keeps track of who is signed in and shares it with every screen.
// Supabase stores the session in the browser and refreshes it; we just listen.
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthContext } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // When the person changes (sign out, or the dev role switcher), drop
      // every cached query so nobody sees the previous person's data.
      const newUserId = newSession?.user.id ?? null;
      if (newUserId !== lastUserId.current) {
        queryClient.clear();
        lastUserId.current = newUserId;
      }
      setSession(newSession);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return <AuthContext.Provider value={{ session, ready }}>{children}</AuthContext.Provider>;
}
