// Round initials badge, e.g. "OK" for Omar K. Initials come from
// profiles.avatar_initials, or are worked out from the name.
import { initialsFrom } from '@/lib/initials';
import styles from './Avatar.module.css';

interface AvatarProps {
  name: string;
  initials?: string | null;
  size?: 'small' | 'normal';
  tone?: 'accent' | 'quiet' | 'ink';
}

export function Avatar({ name, initials, size = 'normal', tone = 'accent' }: AvatarProps) {
  return (
    <span
      className={`${styles.avatar} ${styles[size]} ${styles[tone]}`}
      aria-hidden="true"
      title={name}
    >
      {initials || initialsFrom(name)}
    </span>
  );
}
