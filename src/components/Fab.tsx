// The round glass "+" button for creating something (new event, new post).
// It is a link, so it gets an aria-label because it has no visible text.
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import styles from './Fab.module.css';

export function Fab({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className={`glass ${styles.fab} pressable`} aria-label={label}>
      <Icon name="plus" size={22} />
    </Link>
  );
}
