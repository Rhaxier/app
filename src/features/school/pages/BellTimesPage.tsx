// Bell times, for everyone (from Home): the periods of any school day. Each
// weekday has its own timings, so the list shows the chosen date's: a short
// Friday looks shorter. Holidays and whole-school blackouts say so. Admins
// change the periods in Admin > School calendar (one by one, or as a CSV).
import { useState } from 'react';
import { ButtonLink } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { DateStrip } from '@/components/DateStrip';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { useAppSettings } from '@/features/settings/hooks';
import { dayKey, dayLabels, formatTimeRange } from '@/lib/dates';
import { isAdmin } from '@/lib/permissions';
import type { Period } from '../api';
import { useCalendarData, usePeriods } from '../hooks';
import { bellTimesOn, dayNote, periodsOn, schoolDaysOfWeek, type CalendarData } from '../logic';
import styles from './BellTimesPage.module.css';

export function BellTimesPage() {
  const settings = useAppSettings();
  const periods = usePeriods();
  const calendar = useCalendarData();

  if (settings.isPending || periods.isPending) return <LoadingState shape="row" count={6} />;
  if (settings.isError || periods.isError) {
    const failed = settings.isError ? settings : periods;
    return <ErrorState error={failed.error} onRetry={() => failed.refetch()} />;
  }
  return (
    <BellTimes schoolDays={settings.data.school_days} periods={periods.data} calendar={calendar} />
  );
}

interface BellTimesProps {
  schoolDays: number[];
  periods: Period[];
  /** Terms, holidays and blackouts; null while they load. */
  calendar: CalendarData | null;
}

// Split out so the chosen day starts once the school week is known.
function BellTimes({ schoolDays, periods, calendar }: BellTimesProps) {
  const user = useCurrentUser();
  const settings = { school_days: schoolDays };
  const [weekOffset, setWeekOffset] = useState(0);
  const days = schoolDaysOfWeek(weekOffset, settings);
  // Open on today, or the next school day this week (or the first one).
  const [day, setDay] = useState(() => days.find((d) => d >= dayKey()) ?? days[0]);

  const bells = bellTimesOn(day, periods);
  const note = calendar ? dayNote(day, calendar) : null;
  const heading = dayLabels(day).long;

  function changeWeek(offset: number) {
    const nextDays = schoolDaysOfWeek(offset, settings);
    setWeekOffset(offset);
    setDay(nextDays[0]);
  }

  return (
    <div className="stack">
      <PageHeader
        back={{ to: '/', label: 'Home' }}
        title="Bell times"
        action={
          isAdmin(user) ? (
            <ButtonLink to="/admin/school-week" variant="secondary" size="small">
              Change
            </ButtonLink>
          ) : undefined
        }
      />

      <DateStrip
        days={days}
        selected={day}
        onSelect={setDay}
        canGoBack={weekOffset > 0}
        onPreviousWeek={() => changeWeek(weekOffset - 1)}
        onNextWeek={() => changeWeek(weekOffset + 1)}
        dayNoteFor={(d) =>
          (calendar ? dayNote(d, calendar)?.text : null) ??
          (periodsOn(d, periods).length === 0 ? 'No periods' : null)
        }
      />

      <section className="stack-tight" aria-labelledby="bell-day-heading">
        <h2 id="bell-day-heading" className={styles.heading}>
          {heading}
        </h2>
        {note && <p className="meta">{note.text}</p>}
        {bells.length === 0 ? (
          <EmptyState icon="clock" title="No periods on this day" />
        ) : (
          <Card flush>
            <ol className={styles.list} aria-label={`Periods on ${heading}`}>
              {bells.map((bell) => (
                <li key={bell.id} className={styles.row}>
                  <span className={styles.name}>{bell.name}</span>
                  {bell.now && <Badge tone="good">Now</Badge>}
                  <span className={styles.time}>{formatTimeRange(bell.start, bell.end)}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </section>
    </div>
  );
}
