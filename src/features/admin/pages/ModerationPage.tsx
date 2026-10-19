// Admin > Moderation: everything people reported, and collab posts that a
// teacher has hidden for review.
import { Link } from 'react-router-dom';
import { Card } from '@/components/Card';
import { PageHeader, SectionHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ContentReportCard } from '@/features/approvals/components/ContentReportCard';
import { usePosts } from '@/features/collab/hooks';
import { useContentReports } from '../hooks';

export function ModerationPage() {
  const reports = useContentReports();
  const posts = usePosts();
  const hidden = (posts.data ?? []).filter((post) => post.hidden_by);

  return (
    <div className="stack">
      <PageHeader back={{ to: '/admin', label: 'Admin' }} title="Moderation" />
      <section className="stack-tight" aria-labelledby="mod-reports">
        <SectionHeader id="mod-reports" title="Reported content" />
        {reports.isPending && <LoadingState />}
        {reports.isError && <ErrorState error={reports.error} onRetry={() => reports.refetch()} />}
        {reports.data?.length === 0 && <EmptyState icon="flag" title="Nothing has been reported" />}
        {reports.data?.map((report) => (
          <ContentReportCard key={report.id} report={report} />
        ))}
      </section>
      <section className="stack-tight" aria-labelledby="mod-hidden">
        <SectionHeader id="mod-hidden" title="Hidden collab posts" />
        {posts.data && hidden.length === 0 && <p className="meta">No posts are hidden.</p>}
        {hidden.map((post) => (
          <Card key={post.id} className="stack-tight">
            <Link to={`/collab/${post.id}`}>{post.title}</Link>
            <p className="meta">
              By {post.owner?.full_name}
              {post.hidden_reason ? ` · “${post.hidden_reason}”` : ''}
            </p>
          </Card>
        ))}
      </section>
    </div>
  );
}
