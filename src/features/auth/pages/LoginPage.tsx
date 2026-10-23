// Sign-in screen. In dev mode: email + password for the seeded users (or the
// Dev button). With Google or Microsoft configured (VITE_AUTH_PROVIDER), that
// provider's button is the way in. The other options stay visible but disabled
// so it's clear they exist (docs/OPEN_QUESTIONS.md, Q5).
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { FormError, TextField } from '@/components/Input';
import { school } from '@/config/school';
import { usePublicStatus } from '@/features/settings/hooks';
import { env } from '@/lib/env';
import { errorMessage } from '@/lib/errors';
import { useAuth, usePasswordSignIn, useSchoolSignIn } from '../hooks';
import styles from './LoginPage.module.css';

// Supabase Auth's messages, reworded for students.
function signInMessage(error: unknown): string {
  const message = errorMessage(error);
  if (message.includes('Invalid login credentials')) return "That email and password don't match.";
  if (message.includes('Database error saving new user')) {
    return 'Please sign in with your school email account.';
  }
  return message;
}

// After a refused Google/Microsoft sign-in, Supabase sends the reason back in the URL.
function errorFromRedirect(search: string, hash: string): string | null {
  const params = new URLSearchParams(search || hash.replace(/^#/, ''));
  const description = params.get('error_description');
  return description ? signInMessage({ message: description }) : null;
}

export function LoginPage() {
  const { session, ready } = useAuth();
  const location = useLocation();
  const passwordSignIn = usePasswordSignIn();
  const schoolSignIn = useSchoolSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(() =>
    errorFromRedirect(location.search, location.hash),
  );

  // Already signed in: go where they were heading, or Home.
  // The school's name and logo (Admin > System > Branding); works signed out.
  const status = usePublicStatus().data;

  if (ready && session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setFormError('Enter your email and password.');
      return;
    }
    setFormError(null);
    passwordSignIn.mutate(
      { email: email.trim(), password },
      { onError: (error) => setFormError(signInMessage(error)) },
    );
  }

  function handleSchoolSignIn(provider: 'google' | 'azure') {
    setFormError(null);
    schoolSignIn.mutate(provider, { onError: (error) => setFormError(signInMessage(error)) });
  }

  const isDev = env.authProvider === 'dev';

  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        {/* The school's logo and name from Admin > System > Branding, once set. */}
        {status?.logo_url ? (
          <img className={styles.logoImage} src={status.logo_url} alt="" />
        ) : (
          <span className={styles.logo} aria-hidden="true">
            <Icon name="home" size={28} />
          </span>
        )}
        <p className="meta">{status?.school_name ?? school.name}</p>
        <h1>{school.appName}</h1>
      </div>

      <Card className={styles.card}>
        <h2 className={styles.heading}>Sign in</h2>

        <div className={styles.providers}>
          <Button
            variant={env.authProvider === 'google' ? 'primary' : 'secondary'}
            fullWidth
            disabled={env.authProvider !== 'google'}
            loading={schoolSignIn.isPending && schoolSignIn.variables === 'google'}
            onClick={() => handleSchoolSignIn('google')}
          >
            Continue with Google
          </Button>
          <Button
            variant={env.authProvider === 'azure' ? 'primary' : 'secondary'}
            fullWidth
            disabled={env.authProvider !== 'azure'}
            loading={schoolSignIn.isPending && schoolSignIn.variables === 'azure'}
            onClick={() => handleSchoolSignIn('azure')}
          >
            Continue with Microsoft
          </Button>
          {isDev && (
            <p className="meta">School sign-in isn't set up yet. Use a test account below.</p>
          )}
        </div>

        {isDev && (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student.g10.a@dev.local"
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint="Test accounts use devpass123. Or tap Dev (bottom right) to pick one."
            />
            <FormError message={formError} />
            <Button type="submit" fullWidth loading={passwordSignIn.isPending}>
              Sign in
            </Button>
          </form>
        )}
        {!isDev && <FormError message={formError} />}
      </Card>
    </main>
  );
}
