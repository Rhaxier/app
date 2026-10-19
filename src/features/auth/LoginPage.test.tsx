// The sign-in form checks its fields before calling Supabase, and rewords
// Supabase's errors for students.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { LoginPage } from './pages/LoginPage';

const passwordSignIn = { mutate: vi.fn(), isPending: false };
vi.mock('./hooks', () => ({
  useAuth: () => ({ session: null, ready: true }),
  usePasswordSignIn: () => passwordSignIn,
  useSchoolSignIn: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('LoginPage (dev mode)', () => {
  // A block body on purpose: if beforeEach returns a function, Vitest runs it
  // after the test as a clean-up step (mockReset() returns the mock itself).
  beforeEach(() => {
    passwordSignIn.mutate.mockReset();
  });

  it('asks for both fields before trying to sign in', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email and password.');
    expect(passwordSignIn.mutate).not.toHaveBeenCalled();
  });

  it('signs in with what was typed', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' });
    await userEvent.type(screen.getByLabelText('Email'), 'student.g8.a@dev.local');
    await userEvent.type(screen.getByLabelText('Password'), 'devpass123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(passwordSignIn.mutate).toHaveBeenCalledWith(
      { email: 'student.g8.a@dev.local', password: 'devpass123' },
      expect.anything(),
    );
  });

  it('explains a wrong password in plain words', async () => {
    passwordSignIn.mutate.mockImplementation((_values, options) =>
      options.onError({ message: 'Invalid login credentials' }),
    );
    renderWithProviders(<LoginPage />, { route: '/login' });
    await userEvent.type(screen.getByLabelText('Email'), 'student.g8.a@dev.local');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent("That email and password don't match.");
  });

  it('keeps Google and Microsoft visible but disabled until configured', () => {
    renderWithProviders(<LoginPage />, { route: '/login' });
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continue with Microsoft' })).toBeDisabled();
  });
});
