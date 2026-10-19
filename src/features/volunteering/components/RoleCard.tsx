// One role on the event page: what it involves, how full it is, and the
// student's own status with Sign up / Withdraw.
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { signupStatus } from '@/lib/status';
import type { EventRole, MySignup } from '../api';
import { filledLabel, roleSpotsLeft } from '../logic';
import styles from './RoleCard.module.css';

interface RoleCardProps {
  role: EventRole;
  mySignup?: MySignup;
  /** Why the student can't sign up, if they can't (closed, organiser, one role only). */
  blockedReason: string | null;
  busy: boolean;
  onSignUp: () => void;
  onWithdraw: (signup: MySignup) => void;
  onSignUpAgain: (signup: MySignup) => void;
}

export function RoleCard({
  role,
  mySignup,
  blockedReason,
  busy,
  onSignUp,
  onWithdraw,
  onSignUpAgain,
}: RoleCardProps) {
  const full = roleSpotsLeft(role) === 0;
  const active = mySignup && ['applied', 'selected', 'waitlisted'].includes(mySignup.status);

  return (
    <Card as="li" className={styles.card}>
      <div className={styles.top}>
        <h3>{role.name}</h3>
        {mySignup && <StatusBadge map={signupStatus} status={mySignup.status} />}
      </div>
      {role.description && <p className={styles.description}>{role.description}</p>}
      <p className="meta">
        {filledLabel(role)}
        {role.waitlisted_count > 0 && ` · ${role.waitlisted_count} waitlisted`}
      </p>
      {mySignup?.status === 'selected' && (
        <p className={styles.selected}>You're in. The organiser may contact you by school email.</p>
      )}

      {active && (
        <Button
          variant="secondary"
          size="small"
          loading={busy}
          onClick={() => onWithdraw(mySignup)}
        >
          Withdraw
        </Button>
      )}
      {mySignup?.status === 'withdrawn' && !blockedReason && (
        <Button
          variant="secondary"
          size="small"
          loading={busy}
          onClick={() => onSignUpAgain(mySignup)}
        >
          Sign up again
        </Button>
      )}
      {!mySignup &&
        (blockedReason ? (
          <p className="meta">{blockedReason}</p>
        ) : (
          <Button variant={full ? 'secondary' : 'primary'} size="small" onClick={onSignUp}>
            {full ? 'Join the waitlist' : 'Sign up'}
          </Button>
        ))}
    </Card>
  );
}
