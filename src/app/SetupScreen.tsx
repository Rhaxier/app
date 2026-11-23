// Shown instead of the app when .env hasn't been filled in, so a first run
// explains what to do instead of failing with network errors.
import { useEffect } from 'react';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import styles from './guards.module.css';
import { releaseSplash } from '@/lib/splash';

export function SetupScreen() {
  useEffect(() => releaseSplash(), []);
  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Almost there" title="Connect to Supabase" />
      <Card className="stack-tight">
        <p>The app needs a Supabase project to talk to.</p>
        <ol className="stack-tight" style={{ listStyle: 'decimal', paddingLeft: 20 }}>
          <li>
            Copy <code>.env.example</code> to <code>.env</code>.
          </li>
          <li>
            Run <code>npm run db:start</code> (needs Docker) and copy the API URL and anon key into{' '}
            <code>.env</code>. Or use a free cloud project: see the README.
          </li>
          <li>
            Restart <code>npm run dev</code>.
          </li>
        </ol>
      </Card>
    </div>
  );
}
