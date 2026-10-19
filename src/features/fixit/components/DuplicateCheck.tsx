// Before reporting, show what's already open in the room. "Me too" adds a
// vote instead of a second report (plan: "Check for duplicates first").
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { reportCategoryLabel, reportStatus } from '@/lib/status';
import { useOpenReportsInRoom } from '../hooks';
import { reportTitle } from '../logic';
import { MeTooButton } from './MeTooButton';
import styles from './DuplicateCheck.module.css';

export function DuplicateCheck({ roomId }: { roomId: string }) {
  const reports = useOpenReportsInRoom(roomId);
  if (!reports.data || reports.data.length === 0) return null;

  return (
    <section className={styles.box} aria-labelledby="already-reported">
      <h2 id="already-reported" className={styles.heading}>
        Already reported here
      </h2>
      <p className="meta">Is it one of these? Tap Me too instead of reporting it again.</p>
      {reports.data.map((report) => (
        <Card key={report.id} className={styles.report}>
          <div className={styles.top}>
            <div>
              <p className={styles.title}>{reportTitle(report.description)}</p>
              <p className="meta">{reportCategoryLabel[report.category]}</p>
            </div>
            <StatusBadge map={reportStatus} status={report.status} />
          </div>
          <MeTooButton
            reportId={report.id}
            count={report.vote_count}
            votedByMe={report.voted_by_me}
            reportedByMe={report.reported_by_me}
            fullWidth
          />
        </Card>
      ))}
    </section>
  );
}
