// The card under the map for a selected fix-it pin (reference screen 2):
// "FIX-IT · ROOM G.15", what's wrong, when and which team, Me too, Report new.
import { Link } from 'react-router-dom';
import { ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { StatusBadge } from '@/components/StatusBadge';
import { reportStatus } from '@/lib/status';
import type { Report } from '../api';
import { reportLabel, reportSummary, reportTitle } from '../logic';
import { MeTooButton } from './MeTooButton';
import styles from './ReportCard.module.css';

export function ReportCard({ report }: { report: Report }) {
  return (
    <Card className={styles.card} aria-live="polite">
      <div className={styles.top}>
        <div className={styles.text}>
          <p className={`label ${styles.label}`}>
            {reportLabel(report)}
            {report.urgent && ' · Urgent'}
          </p>
          <h2 className={styles.title}>
            <Link to={`/reports/${report.id}`}>{reportTitle(report.description)}</Link>
          </h2>
          <p className="meta">{reportSummary(report)}</p>
        </div>
        {report.photo_path ? (
          <Link to={`/reports/${report.id}`} className={styles.thumb} aria-label="See the photo">
            <Icon name="image" />
          </Link>
        ) : (
          <StatusBadge map={reportStatus} status={report.status} />
        )}
      </div>
      <div className={styles.actions}>
        <MeTooButton
          reportId={report.id}
          count={report.vote_count}
          votedByMe={report.voted_by_me}
          reportedByMe={report.reported_by_me}
        />
        <ButtonLink to={`/map/report?room=${report.room_id ?? ''}`} variant="alert" icon="camera">
          Report new
        </ButtonLink>
      </div>
    </Card>
  );
}
