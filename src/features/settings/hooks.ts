// Settings change rarely, so they're cached for ten minutes.
import { useQuery } from '@tanstack/react-query';
import { fetchAppSettings } from './api';

export const settingsKeys = {
  all: ['app-settings'] as const,
};

export function useAppSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: fetchAppSettings,
    staleTime: 10 * 60_000,
  });
}
