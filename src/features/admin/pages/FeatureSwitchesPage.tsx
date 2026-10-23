// Admin > System > Feature switches. Switching a feature off hides its tab and
// entry points for everyone but admins, and the database refuses new content
// for it (block_disabled_feature). What's already there is kept and readable
// again as soon as it's switched back on.
import { Card } from '@/components/Card';
import { ErrorState, LoadingState } from '@/components/States';
import { Switch } from '@/components/Switch';
import { useFeatureFlags, useSetFeatureFlag } from '@/features/settings/hooks';
import { featureDescription, featureLabel } from '@/features/settings/logic';
import { AdminPage } from '../components/AdminPage';

export function FeatureSwitchesPage() {
  const flags = useFeatureFlags();
  const save = useSetFeatureFlag();

  return (
    <AdminPage
      title="Feature switches"
      description="Turn whole features off and on. Admins always see everything."
    >
      {flags.isPending && <LoadingState shape="row" count={7} />}
      {flags.isError && <ErrorState error={flags.error} onRetry={() => flags.refetch()} />}
      {flags.data && (
        <Card>
          {[...flags.data]
            .sort((a, b) => featureLabel[a.feature].localeCompare(featureLabel[b.feature]))
            .map((flag) => (
              <Switch
                key={flag.feature}
                label={featureLabel[flag.feature]}
                hint={featureDescription[flag.feature]}
                checked={flag.enabled}
                disabled={save.isPending}
                onChange={(enabled) => save.mutate({ feature: flag.feature, enabled })}
              />
            ))}
        </Card>
      )}
      <p className="meta">
        Off means: no tab or tile, and nobody but admins can add anything new. Nothing is deleted.
      </p>
    </AdminPage>
  );
}
