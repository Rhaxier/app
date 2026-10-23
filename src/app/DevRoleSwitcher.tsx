// Dev only (VITE_AUTH_PROVIDER=dev): a floating "Dev" button that signs you in
// as any seeded user in one tap. This is how to test permissions: try something
// as a student, switch to a teacher, approve it, switch back.
import { useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { Sheet } from '@/components/Sheet';
import { useAuth, usePasswordSignIn } from '@/features/auth/hooks';
import { errorMessage } from '@/lib/errors';
import { DEV_PASSWORD, devUserGroups, type DevUser } from './devUsers';
import styles from './DevRoleSwitcher.module.css';

export function DevRoleSwitcher() {
  const { session } = useAuth();
  const signIn = usePasswordSignIn();
  const [open, setOpen] = useState(false);
  const currentEmail = session?.user.email;

  function switchTo(user: DevUser) {
    signIn.mutate(
      { email: user.email, password: DEV_PASSWORD },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <>
      <button
        type="button"
        className={[styles.trigger, session && styles.aboveTabs].filter(Boolean).join(' ')}
        onClick={() => setOpen(true)}
        aria-label="Dev role switcher: sign in as a test user"
      >
        Dev
      </button>
      <Sheet open={open} title="Sign in as…" onClose={() => setOpen(false)}>
        {signIn.isError && (
          <p className={styles.error} role="alert">
            {errorMessage(signIn.error)} Is the database seeded? Run npm run db:reset.
          </p>
        )}
        {devUserGroups.map((group) => (
          <section key={group.title} className={styles.group}>
            <h3 className="label">{group.title}</h3>
            <ul className={styles.list}>
              {group.users.map((user) => {
                const isCurrent = user.email === currentEmail;
                return (
                  <li key={user.email}>
                    <button
                      type="button"
                      className={`${styles.user} pressable`}
                      aria-current={isCurrent || undefined}
                      disabled={signIn.isPending}
                      onClick={() => switchTo(user)}
                    >
                      <Avatar name={user.name} size="small" tone={isCurrent ? 'ink' : 'accent'} />
                      <span className={styles.userText}>
                        <span className={styles.name}>
                          {user.name}
                          {isCurrent && <span className="meta"> · signed in</span>}
                        </span>
                        <span className="meta">{user.note}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </Sheet>
    </>
  );
}
