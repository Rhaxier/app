// The round teal "+" button for creating something (new project, new post).
// It is a link, so it gets an aria-label because it has no visible text.
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import styles from './Fab.module.css';

export function Fab({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className={styles.fab} aria-label={label}>
      <Icon name="plus" size={24} />
    </Link>
  );
}
