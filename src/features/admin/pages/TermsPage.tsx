// Admin > Terms and holidays. Holidays can't be booked (the database refuses
// them) and are greyed out on the booking calendar; volunteering forms warn
// about them. Days outside every term are marked "Outside term time".
import { useHolidays, useTerms } from '@/features/school/hooks';
import { AdminPage } from '../components/AdminPage';
import { DateRangeList } from '../components/DateRangeList';

export function TermsPage() {
  const terms = useTerms();
  const holidays = useHolidays();
  return (
    <AdminPage title="Terms and holidays" description="The school year, and days off.">
      <DateRangeList
        table="terms"
        title="Terms"
        noun="term"
        description="Each term's first and last day."
        rows={terms.data}
        loading={terms.isPending}
        error={terms.error}
        onRetry={() => terms.refetch()}
      />
      <DateRangeList
        table="holidays"
        title="Holidays"
        noun="holiday"
        description="Single days or breaks. No venue can be booked on them."
        rows={holidays.data}
        loading={holidays.isPending}
        error={holidays.error}
        onRetry={() => holidays.refetch()}
      />
    </AdminPage>
  );
}
