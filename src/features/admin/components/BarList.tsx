// A small horizontal bar chart drawn with plain HTML: one row per item, the
// name on the left, the bar, and the value written at the bar's tip. Used on
// the admin overview (venue utilisation, SUPW hours per grade).
//
// Chart rules followed (from the dataviz guidance):
//   * one series, so one colour (the accent) and no legend: the heading names it
//   * thin bars growing from one baseline, rounded only at the data end
//   * every value is written as text, so nothing depends on colour or size alone
//   * "Show as a table" gives the same numbers as a real table
// `max` sets what a full-width bar means: 1 for shares (a meter with a track),
// or the largest value for amounts.
import styles from './BarList.module.css';

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** The text at the bar's tip, e.g. "42% · 12 of 30 h". */
  valueLabel: string;
}

interface BarListProps {
  /** Names the chart for screen readers and the table caption. */
  title: string;
  bars: Bar[];
  /** 'share': value is 0–1, drawn on a full-width track. 'amount': scaled to the largest. */
  kind: 'share' | 'amount';
  /** Column headings for the table view. */
  columns: [string, string];
}

export function BarList({ title, bars, kind, columns }: BarListProps) {
  const max = kind === 'share' ? 1 : Math.max(...bars.map((bar) => bar.value), 0);
  return (
    <div className="stack-tight">
      <ul className={styles.list} aria-label={title}>
        {bars.map((bar) => {
          const width = max > 0 ? Math.min(1, bar.value / max) : 0;
          return (
            <li key={bar.key} className={styles.row}>
              <span className={styles.label}>{bar.label}</span>
              <span className={kind === 'share' ? `${styles.track} ${styles.meter}` : styles.track}>
                <span className={styles.bar} style={{ width: `${width * 100}%` }} />
              </span>
              <span className={styles.value}>{bar.valueLabel}</span>
            </li>
          );
        })}
      </ul>
      <details className={styles.details}>
        <summary className="meta">Show as a table</summary>
        <table className={styles.table}>
          <caption className="visually-hidden">{title}</caption>
          <thead>
            <tr>
              <th scope="col">{columns[0]}</th>
              <th scope="col">{columns[1]}</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.key}>
                <th scope="row">{bar.label}</th>
                <td>{bar.valueLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
