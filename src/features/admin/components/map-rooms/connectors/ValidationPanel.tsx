// What is wrong with the stairs and lifts as they stand (unsaved changes
// included), straight from the linking check: a summary line, then errors
// (they block Save), then warnings. Each line is a button that selects the
// staircase or lift concerned and switches to the floor it's about.
import { StatusBadge } from '@/components/StatusBadge';
import type { FloorId, Problem } from '@/features/map/nav/types';
import styles from './Connectors.module.css';

const severityLook = {
  error: { label: 'Fix', tone: 'fix' },
  warning: { label: 'Warning', tone: 'attention' },
} as const;

interface ValidationPanelProps {
  summary: { connected: boolean; text: string };
  problems: Problem[];
  onPick: (problem: { connector?: string; floor?: FloorId }) => void;
}

export function ValidationPanel({ summary, problems, onPick }: ValidationPanelProps) {
  return (
    <section className="stack-tight" aria-label="Checks">
      <p
        className={summary.connected ? styles.summaryOk : styles.summaryWait}
        role="status"
        aria-live="polite"
      >
        {summary.text}
      </p>
      {problems.length > 0 && (
        <ul className={styles.problems}>
          {problems.map((problem, index) => (
            <li key={`${problem.code}:${problem.connector ?? ''}:${problem.floor ?? ''}:${index}`}>
              <button
                type="button"
                className={styles.problem}
                disabled={!problem.connector && !problem.floor}
                onClick={() => onPick(problem)}
              >
                <StatusBadge map={severityLook} status={problem.severity} />
                <span>{problem.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
