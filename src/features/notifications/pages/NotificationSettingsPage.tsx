// Mute settings. Approvals and urgent items can't be muted (the database
// ignores mutes for them), so their switches are locked on.
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { Switch } from '@/components/Switch';
import { useCurrentUser } from '@/features/auth/hooks';
import { isStaff } from '@/lib/permissions';
import { useMutedTypes, useSetMuted } from '../hooks';
import {
  STAFF_ONLY_TYPES,
  UNMUTABLE_TYPES,
  notificationTypeLabel,
  type NotificationType,
} from '../types';

export function NotificationSettingsPage() {
  const user = useCurrentUser();
  const muted = useMutedTypes();
  const setMuted = useSetMuted();

  const types = (Object.keys(notificationTypeLabel) as NotificationType[]).filter(
    (type) => isStaff(user) || !STAFF_ONLY_TYPES.includes(type),
  );

  return (
    <div className="stack">
      <PageHeader
        back={{ to: '/notifications', label: 'Notifications' }}
        title="Notification settings"
        subtitle="Choose what you hear about. Urgent items always come through."
      />
      {muted.isPending && <LoadingState />}
      {muted.isError && <ErrorState error={muted.error} onRetry={() => muted.refetch()} />}
      {muted.data && (
        <Card>
          {types.map((type) => {
            const locked = UNMUTABLE_TYPES.includes(type);
            return (
              <Switch
                key={type}
                label={notificationTypeLabel[type]}
                hint={locked ? 'Always on: someone is waiting for you' : undefined}
                checked={locked || !muted.data.includes(type)}
                disabled={locked || setMuted.isPending}
                onChange={(on) => setMuted.mutate({ type, muted: !on })}
              />
            );
          })}
        </Card>
      )}
    </div>
  );
}
