// "Me": who you're signed in as, your role and jobs, and sign out.
import { Avatar } from '@/components/Avatar';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { Tag } from '@/components/Chip';
import { PageHeader } from '@/components/PageHeader';
import { isAdmin } from '@/lib/permissions';
import { responsibilityLabel, roleLabel } from '@/lib/status';
import { useCurrentUser, useSignOut } from '../hooks';
import styles from './ProfilePage.module.css';

export function ProfilePage() {
  const user = useCurrentUser();
  const signOut = useSignOut();

  const details = [
    roleLabel[user.role],
    user.grade ? `Grade ${user.grade}${user.section ? ` ${user.section}` : ''}` : null,
  ].filter(Boolean);

  return (
    <div className="stack">
      <PageHeader back={{ to: '/', label: 'Home' }} title="Me" />

      <Card className={styles.person}>
        <Avatar name={user.full_name} initials={user.avatar_initials} />
        <div>
          <h2 className={styles.name}>{user.full_name}</h2>
          <p className="meta">{user.email}</p>
          <p className="meta">{details.join(' · ')}</p>
        </div>
      </Card>

      {user.responsibilities.length > 0 && (
        <Card className="stack-tight">
          <h3>Your jobs</h3>
          <div className="row-wrap">
            {user.responsibilities.map((kind) => (
              <Tag key={kind} tone="accent">
                {responsibilityLabel[kind]}
              </Tag>
            ))}
          </div>
        </Card>
      )}

      <div className="stack-tight">
        <ButtonLink to="/notifications/settings" variant="secondary" icon="settings" fullWidth>
          Notification settings
        </ButtonLink>
        {isAdmin(user) && (
          <ButtonLink to="/admin" variant="secondary" icon="shield" fullWidth>
            Admin
          </ButtonLink>
        )}
        <Button
          variant="quiet"
          icon="logout"
          fullWidth
          loading={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
