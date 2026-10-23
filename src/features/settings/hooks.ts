// Settings, branding and feature switches. They change rarely, so they're
// cached for ten minutes (five for the public status, which also carries the
// maintenance message).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAppSettings,
  fetchFeatureFlags,
  fetchPublicStatus,
  setFeatureFlag,
  type FeatureFlag,
  type FeatureName,
} from './api';

export const settingsKeys = {
  all: ['app-settings'] as const,
  status: ['public-status'] as const,
  features: ['feature-flags'] as const,
};

export function useAppSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: fetchAppSettings,
    staleTime: 10 * 60_000,
  });
}

/** Works signed out too: the sign-in screen shows the name, logo and any maintenance notice. */
export function usePublicStatus() {
  return useQuery({
    queryKey: settingsKeys.status,
    queryFn: fetchPublicStatus,
    staleTime: 5 * 60_000,
  });
}

/** Signed-in screens only (signed-out visitors can't read the switches). */
export function useFeatureFlags() {
  return useQuery({
    queryKey: settingsKeys.features,
    queryFn: fetchFeatureFlags,
    staleTime: 10 * 60_000,
  });
}

/**
 * Should this person see a feature? Admins always do (so they can switch it
 * back on and check what's there). While the switches load, everything shows.
 */
export function useFeatureVisible(isAdmin: boolean): (feature: FeatureName) => boolean {
  const flags = useFeatureFlags().data;
  return (feature) => isAdmin || (flags?.find((f) => f.feature === feature)?.enabled ?? true);
}

/** Optimistic: the switch flips at once, and flips back if the database refuses. */
export function useSetFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ feature, enabled }: { feature: FeatureName; enabled: boolean }) =>
      setFeatureFlag(feature, enabled),
    onMutate: async ({ feature, enabled }) => {
      await queryClient.cancelQueries({ queryKey: settingsKeys.features });
      const before = queryClient.getQueryData<FeatureFlag[]>(settingsKeys.features);
      queryClient.setQueryData<FeatureFlag[]>(settingsKeys.features, (flags) =>
        flags?.map((flag) => (flag.feature === feature ? { ...flag, enabled } : flag)),
      );
      return { before };
    },
    onError: (_error, _variables, context) =>
      queryClient.setQueryData(settingsKeys.features, context?.before),
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.features }),
    meta: { successMessage: 'Saved', errorToast: true },
  });
}
