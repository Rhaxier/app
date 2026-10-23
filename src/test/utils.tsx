// Helpers for UI tests: render a component inside the providers it needs
// (router + TanStack Query + toasts), and build fake signed-in users.
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from '@/components/Toaster';
import type { CurrentUser } from '@/features/auth/api';
import { createQueryClient } from '@/lib/queryClient';

export function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 'user-1',
    full_name: 'Student Grade 10 A',
    email: 'student.g10.a@dev.local',
    role: 'student',
    grade: 10,
    section: 'A',
    avatar_initials: null,
    responsibilities: [],
    ...overrides,
  };
}

export const teacher = makeUser({
  id: 'teacher-1',
  full_name: 'Teacher A',
  email: 'teacher.a@dev.local',
  role: 'teacher',
  grade: null,
  section: null,
  responsibilities: ['supw'],
});

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', queryClient }: { route?: string; queryClient?: QueryClient } = {},
) {
  // A fresh cache per test (unless the test brings one to fill in first), with
  // no retries, so failures show up immediately. Same toast handling as the app.
  const client = queryClient ?? createQueryClient({ retry: false });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}
