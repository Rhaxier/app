// /admin itself. On a laptop the menu is already on the left, so this shows
// the Overview. On a phone it's the menu: a list of every section.
import { useMediaQuery, WIDE_SCREEN } from '@/lib/useMediaQuery';
import { PageHeader } from '@/components/PageHeader';
import { AdminMenu } from '../components/AdminMenu';
import { OverviewPage } from './OverviewPage';

export function AdminIndexPage() {
  const wide = useMediaQuery(WIDE_SCREEN);
  if (wide) return <OverviewPage />;
  return (
    <div className="stack">
      <PageHeader
        back={{ to: '/approvals', label: 'Approvals' }}
        title="Admin"
        subtitle="Every change here is recorded in the audit log."
      />
      <AdminMenu />
    </div>
  );
}
