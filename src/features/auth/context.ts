// The shape of what AuthProvider shares with the rest of the app.
import type { Session } from '@supabase/supabase-js';
import { createContext } from 'react';

export interface AuthState {
  /** The Supabase session, or null when signed out. */
  session: Session | null;
  /** False until we've checked for a saved session (avoids a flash of the login page). */
  ready: boolean;
}

export const AuthContext = createContext<AuthState | null>(null);
