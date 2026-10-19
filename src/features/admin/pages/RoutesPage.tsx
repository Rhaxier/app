// Admin > Report routes (Q1): which team gets each kind of fix-it report.
import { Card } from '@/components/Card';
import { FormError, SelectField } from '@/components/Input';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { useRoutes, useUpdateRoute } from '@/features/fixit/hooks';
import { errorMessage } from '@/lib/errors';
import { reportCategoryLabel, responsibilityLabel } from '@/lib/status';
import { Constants } from '@/types/database';
import type { Responsibility } from '../api';

const kinds = Constants.public.Enums.responsibility_kind as readonly Responsibility[];

export function RoutesPage() {
  const routes = useRoutes();
  const update = useUpdateRoute();
  return (
    <div className="stack">
      <PageHeader
        back={{ to: '/admin', label: 'Admin' }}
        title="Report routes"
        subtitle="New fix-it reports notify everyone holding the chosen responsibility."
      />
      {routes.isPending && <LoadingState />}
      {routes.isError && <ErrorState error={routes.error} onRetry={() => routes.refetch()} />}
      <FormError message={update.isError ? errorMessage(update.error) : null} />
      {routes.data && (
        <Card className="stack-tight">
          {routes.data.map((route) => (
            <SelectField
              key={route.id}
              label={reportCategoryLabel[route.category]}
              value={route.responsibility}
              disabled={update.isPending}
              onChange={(e) =>
                update.mutate({ id: route.id, responsibility: e.target.value as Responsibility })
              }
            >
              {kinds.map((kind) => (
                <option key={kind} value={kind}>
                  {responsibilityLabel[kind]}
                </option>
              ))}
            </SelectField>
          ))}
        </Card>
      )}
    </div>
  );
}
