// Helpers for UI tests: render a component inside the providers it needs
// (router + TanStack Query), and build fake signed-in users.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { CurrentUser } from '@/features/auth/api';

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

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  // A fresh cache per test, with no retries, so failures show up immediately.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
