// Temporary M0 screen: proves the build, tokens and fonts work.
// Replaced by the router and app shell in M2.
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { school } from '@/config/school';

export function App() {
  return (
    <main style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-5)' }}>
      <PageHeader eyebrow={school.name} title={school.appName} />
      <Card>Project skeleton is running.</Card>
    </main>
  );
}
