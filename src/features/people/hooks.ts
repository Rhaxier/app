import { useQuery } from '@tanstack/react-query';
import { fetchStaff } from './api';

export function useStaff() {
  return useQuery({ queryKey: ['people', 'staff'], queryFn: fetchStaff, staleTime: 10 * 60_000 });
}
