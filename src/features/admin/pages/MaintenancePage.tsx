// Admin > System > Maintenance banner. A message at the top of every screen,
// for everyone (the sign-in screen too), until it's switched off or its end
// time passes. Useful before an upgrade or while something is broken.
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError, TextArea, TextField } from '@/components/Input';
import { LoadingState } from '@/components/States';
import { Switch } from '@/components/Switch';
import type { AppSettings } from '@/features/settings/api';
import { useAppSettings } from '@/features/settings/hooks';
import { fromDateTimeInputValue, toDateTimeInputValue } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { AdminPage } from '../components/AdminPage';
import { footnotes, pageIntros } from '../strings';
import { useUpdateSettings } from '../hooks';

export function MaintenancePage() {
  const settings = useAppSettings();
  return (
    <AdminPage title="Maintenance banner" description={pageIntros.maintenance}>
      {settings.isPending && <LoadingState />}
      {settings.data && <MaintenanceForm key={settings.data.updated_at} settings={settings.data} />}
    </AdminPage>
  );
}

function MaintenanceForm({ settings }: { settings: AppSettings }) {
  const save = useUpdateSettings();
  const [enabled, setEnabled] = useState(settings.maintenance_enabled);
  const [message, setMessage] = useState(settings.maintenance_message ?? '');
  const [until, setUntil] = useState(toDateTimeInputValue(settings.maintenance_until));
  const missingMessage = enabled && !message.trim();

  return (
    <Card className="stack-tight">
      <Switch
        label="Show the banner"
        hint={footnotes.maintenance.show}
        checked={enabled}
        onChange={setEnabled}
      />
      <TextArea
        label="Message"
        rows={3}
        maxLength={300}
        placeholder="e.g. The app will be offline tonight from 20:00 to 21:00 for an upgrade."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        error={missingMessage ? 'Write the message people will see.' : undefined}
      />
      <TextField
        label="Hide it after (optional)"
        type="datetime-local"
        hint={footnotes.maintenance.until}
        value={until}
        onChange={(e) => setUntil(e.target.value)}
      />
      <FormError message={save.isError ? errorMessage(save.error) : null} />
      <Button
        fullWidth
        disabled={missingMessage}
        loading={save.isPending}
        onClick={() =>
          save.mutate({
            maintenance_enabled: enabled,
            maintenance_message: message.trim() || null,
            maintenance_until: fromDateTimeInputValue(until),
          })
        }
      >
        Save
      </Button>
    </Card>
  );
}
