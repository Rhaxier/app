// Route guards. RequireAuth sends signed-out people to /login and waits for
// the profile to load. RequireRole shows a friendly "staff only" message.
// RequireFeature shows a note while an admin has switched a feature off.
// These are conveniences: the database refuses the data anyway (RLS).
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth, useCurrentUser, useCurrentUserQuery, useSignOut } from '@/features/auth/hooks';
import type { FeatureName } from '@/features/settings/api';
import { useFeatureVisible } from '@/features/settings/hooks';
import { featureLabel } from '@/features/settings/logic';
import { isAdmin, isStaff } from '@/lib/permissions';
import { holdSplash } from '@/lib/splash';
import styles from './guards.module.css';

export function RequireAuth() {
  const { session, ready } = useAuth();
  const location = useLocation();
  const currentUser = useCurrentUserQuery();
  const signOut = useSignOut();

  if (!ready) return <FullPageLoading />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (currentUser.isPending) return <FullPageLoading />;
  if (currentUser.isError) {
    return (
      <div className={styles.page}>
        <ErrorState error={currentUser.error} onRetry={() => currentUser.refetch()} />
        <Button variant="secondary" onClick={() => signOut.mutate()}>
          Sign out
        </Button>
      </div>
    );
  }
  return <Outlet />;
}

export function RequireRole({ role }: { role: 'staff' | 'admin' }) {
  const user = useCurrentUser();
  const allowed = role === 'admin' ? isAdmin(user) : isStaff(user);
  if (!allowed) {
    return (
      <EmptyState icon="shield" title={role === 'admin' ? 'Admins only' : 'Staff only'}>
        This screen is for {role === 'admin' ? 'admins' : 'teachers and admins'}. If you think you
        should have access, ask an admin.
      </EmptyState>
    );
  }
  return <Outlet />;
}

export function RequireFeature({ feature }: { feature: FeatureName }) {
  const user = useCurrentUser();
  const visible = useFeatureVisible(isAdmin(user));
  if (!visible(feature)) {
    return (
      <EmptyState icon="eyeOff" title={`${featureLabel[feature]} is switched off`}>
        The school has switched this off for now. Anything already here is kept.
      </EmptyState>
    );
  }
  return <Outlet />;
}

function FullPageLoading() {
  // The loading screen (src/lib/splash.ts) stays up while the sign-in check runs.
  useEffect(() => holdSplash(), []);
  return (
    <div className={styles.page}>
      <LoadingState />
    </div>
  );
}
