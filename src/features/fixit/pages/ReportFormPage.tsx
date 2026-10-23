// Report an issue: safety notice first, then pick the room, check what's
// already reported there, and describe the problem (photo optional).
// The database sends it to the right team (report_categories, which admins
// edit in Admin > Fix-it categories).
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/Button';
import { FilterChip } from '@/components/Chip';
import { Icon, ICON_NAMES, type IconName } from '@/components/Icon';
import { CheckboxField, FormError, SelectField, TextArea } from '@/components/Input';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { SAFETY_COPY } from '@/config/school';
import { useCurrentUser } from '@/features/auth/hooks';
import { useRooms } from '@/features/map/hooks';
import { errorMessage } from '@/lib/errors';
import { isStaff } from '@/lib/permissions';
import { DuplicateCheck } from '../components/DuplicateCheck';
import { useCreateReport, useReportCategories } from '../hooks';
import {
  toReportInput,
  validateReport,
  type ReportFormErrors,
  type ReportFormValues,
} from '../logic';
import styles from './ReportFormPage.module.css';

/** The category's icon, or a plain alert icon if the name isn't one we have. */
function iconName(name: string): IconName {
  return (ICON_NAMES as string[]).includes(name) ? (name as IconName) : 'alert';
}

export function ReportFormPage() {
  const [params] = useSearchParams();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const rooms = useRooms();
  const create = useCreateReport();
  const categories = (useReportCategories().data ?? []).filter((c) => c.active);
  const photoInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<ReportFormValues>({
    roomId: params.get('room') ?? '',
    category: '',
    description: '',
    urgent: false,
    photo: null,
  });
  const [errors, setErrors] = useState<ReportFormErrors>({});

  function update<K extends keyof ReportFormValues>(key: K, value: ReportFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateReport(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    create.mutate(
      { input: toReportInput(values), photo: values.photo },
      { onSuccess: (id) => navigate(`/reports/${id}`, { replace: true }) },
    );
  }

  if (rooms.isPending) return <LoadingState />;

  return (
    <div className="stack">
      <PageHeader back={{ to: '/map', label: 'Campus map' }} title="Report an issue" />

      <div className={styles.safety} role="note">
        <Icon name="alert" />
        <p>{SAFETY_COPY}</p>
      </div>

      <form className="stack" onSubmit={handleSubmit} noValidate>
        <SelectField
          label="Where is it?"
          value={values.roomId}
          onChange={(e) => update('roomId', e.target.value)}
          error={errors.roomId}
        >
          <option value="">Choose a room…</option>
          {rooms.data?.map((room) => (
            <option key={room.id} value={room.id}>
              {room.code} · {room.name}
            </option>
          ))}
        </SelectField>

        {values.roomId && <DuplicateCheck roomId={values.roomId} />}

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>What kind of problem?</legend>
          <div className="row-wrap">
            {categories.map((category) => (
              <FilterChip
                key={category.key}
                selected={values.category === category.key}
                onClick={() => update('category', category.key)}
              >
                <Icon name={iconName(category.icon)} size={18} />
                {category.name}
              </FilterChip>
            ))}
          </div>
          {errors.category && (
            <p className={styles.error} role="alert">
              {errors.category}
            </p>
          )}
        </fieldset>

        <TextArea
          label="What's wrong?"
          placeholder="e.g. Projector won't turn on"
          rows={3}
          maxLength={1000}
          value={values.description}
          onChange={(e) => update('description', e.target.value)}
          error={errors.description}
        />

        <div className="stack-tight">
          <span className={styles.legend}>Photo (optional)</span>
          <input
            ref={photoInput}
            id="report-photo"
            type="file"
            accept="image/*"
            capture="environment"
            className="visually-hidden"
            onChange={(e) => update('photo', e.target.files?.[0] ?? null)}
          />
          <Button variant="secondary" icon="camera" onClick={() => photoInput.current?.click()}>
            {values.photo ? `Change photo (${values.photo.name})` : 'Add a photo'}
          </Button>
          {errors.photo && (
            <p className={styles.error} role="alert">
              {errors.photo}
            </p>
          )}
        </div>

        {isStaff(user) && (
          <CheckboxField
            label="Urgent"
            hint="Emails the responsible team straight away."
            checked={values.urgent}
            onChange={(e) => update('urgent', e.target.checked)}
          />
        )}

        <FormError message={create.isError ? errorMessage(create.error) : null} />
        <Button type="submit" variant="alert" fullWidth loading={create.isPending}>
          Send report
        </Button>
        <p className="meta">
          Other students see the problem, not who reported it. Staff can see who reported it.
        </p>
      </form>
    </div>
  );
}
