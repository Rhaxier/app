// The sheet over the map for a selected fix-it pin (reference screen 2; design
// PDF page 6, "Fix-it in place"): "FIX-IT · ROOM G.15", what's wrong, where it
// was sent, how far along it is (Open · Seen · Fixing · Fixed), Me too, and
// Report an issue. It's thick glass, floating above the tab bar.
//
// One pin counts every open report in a room, so when there are several here
// the sheet steps through them (`others`, `onPick`).
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { StatusBadge } from '@/components/StatusBadge';
import { relativeTime } from '@/lib/dates';
import { reportStatus } from '@/lib/status';
import type { Report } from '../api';
import { progressStep, PROGRESS_STEPS, reportLabel, reportSummary, reportTitle } from '../logic';
import { MeTooButton } from './MeTooButton';
import styles from './ReportCard.module.css';

interface ReportCardProps {
  report: Report;
  /** Every open report at this pin, including this one. */
  others?: Report[];
  onPick?: (id: string) => void;
  /** Shows a close button in the top right corner. */
  onClose?: () => void;
}

export function ReportCard({ report, others = [report], onPick, onClose }: ReportCardProps) {
  const step = progressStep(report.status);
  // How much of the rail is filled: up to the middle of the current step's
  // name, or all of it once fixed.
  const fill =
    step === null
      ? 0
      : step === PROGRESS_STEPS.length - 1
        ? 1
        : (step + 0.5) / PROGRESS_STEPS.length;
  const index = others.findIndex((other) => other.id === report.id);

  return (
    <section
      className={`glass thick ${styles.sheet}`}
      aria-label="Fix-it report"
      aria-live="polite"
    >
      <div className={styles.top}>
        <p className={`label ${styles.label}`}>
          {reportLabel(report)}
          {report.urgent && ' · Urgent'}
        </p>
        <span className={styles.topEnd}>
          <span className="meta">{relativeTime(report.created_at)}</span>
          {onClose && (
            <button
              type="button"
              className={`${styles.close} pressable`}
              aria-label="Close fix-it report"
              onClick={onClose}
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </span>
      </div>

      <div className={styles.titleRow}>
        <div className={styles.text}>
          <h2 className={styles.title}>
            <Link to={`/reports/${report.id}`}>{reportTitle(report.description)}</Link>
          </h2>
          <p className="meta">{reportSummary(report)}</p>
        </div>
        {report.photo_path && (
          <Link to={`/reports/${report.id}`} className={styles.thumb} aria-label="See the photo">
            <Icon name="image" />
          </Link>
        )}
      </div>

      {step === null ? (
        <StatusBadge map={reportStatus} status={report.status} />
      ) : (
        // The track: filled up to the current step. Screen readers hear the
        // list of steps, with the current one marked.
        <ol
          className={styles.track}
          aria-label="Progress"
          style={{ '--fill': fill } as CSSProperties}
        >
          {PROGRESS_STEPS.map((name, i) => (
            <li
              key={name}
              className={i <= step ? styles.done : undefined}
              aria-current={i === step ? 'step' : undefined}
            >
              {name}
            </li>
          ))}
        </ol>
      )}

      {others.length > 1 && onPick && (
        <div className={styles.pager}>
          <span className="meta">
            {index + 1} of {others.length} open reports here
          </span>
          <span className={styles.pagerButtons}>
            <button
              type="button"
              className={`${styles.pagerButton} pressable`}
              aria-label="Previous report here"
              disabled={index <= 0}
              onClick={() => onPick(others[index - 1].id)}
            >
              <Icon name="chevronLeft" size={18} />
            </button>
            <button
              type="button"
              className={`${styles.pagerButton} pressable`}
              aria-label="Next report here"
              disabled={index >= others.length - 1}
              onClick={() => onPick(others[index + 1].id)}
            >
              <Icon name="chevronRight" size={18} />
            </button>
          </span>
        </div>
      )}

      <div className={styles.actions}>
        <MeTooButton
          reportId={report.id}
          count={report.vote_count}
          votedByMe={report.voted_by_me}
          reportedByMe={report.reported_by_me}
        />
        <ButtonLink to={`/map/report?room=${report.room_id ?? ''}`} icon="camera">
          Report an issue
        </ButtonLink>
      </div>
    </section>
  );
}
