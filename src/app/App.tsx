// The root of the app: data caching (TanStack Query), who's signed in
// (AuthProvider), animation settings (Motion) and the screens (router).
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from '@/components/Toaster';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { isSupabaseConfigured } from '@/lib/env';
import { queryClient } from '@/lib/queryClient';
import { router } from './router';
import { SetupScreen } from './SetupScreen';

export function App() {
  if (!isSupabaseConfigured) return <SetupScreen />;
  return (
    // reducedMotion="user": when the device asks for less motion, Motion keeps
    // fades but drops movement (the design's "opacity only").
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
        {/* Outside the router, so toasts survive moving between screens. */}
        <Toaster />
      </QueryClientProvider>
    </MotionConfig>
  );
}
