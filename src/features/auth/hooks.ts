// Hooks for the signed-in person. Most screens only need useCurrentUser().
import { useMutation, useQuery } from '@tanstack/react-query';
import { useContext } from 'react';
import {
  fetchCurrentUser,
  signInWithPassword,
  signInWithSchoolAccount,
  signOut,
  type SchoolProvider,
} from './api';
import { AuthContext } from './context';

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}

/** The signed-in person's profile and responsibilities. */
export function useCurrentUserQuery() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['current-user', userId],
    queryFn: () => fetchCurrentUser(userId!, session?.user.email ?? ''),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });
}

/**
 * The signed-in person, for screens behind <RequireAuth> (which waits for the
 * profile before rendering them, so this is never undefined there).
 */
export function useCurrentUser() {
  const { data } = useCurrentUserQuery();
  if (!data) throw new Error('useCurrentUser is only available on signed-in screens');
  return data;
}

export function usePasswordSignIn() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signInWithPassword(email, password),
  });
}

export function useSchoolSignIn() {
  return useMutation({
    mutationFn: (provider: SchoolProvider) => signInWithSchoolAccount(provider),
  });
}

export function useSignOut() {
  return useMutation({ mutationFn: signOut });
}
