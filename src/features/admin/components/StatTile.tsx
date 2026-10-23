// One headline number on the overview: a label, the value, and a short line
// of context underneath (e.g. "avg 2.5 days to resolve").
import styles from './StatTile.module.css';

interface StatTileProps {
  label: string;
  value: string | number;
  detail?: string;
}

export function StatTile({ label, value, detail }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {detail && <p className="meta">{detail}</p>}
    </div>
  );
}
