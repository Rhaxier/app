// Report an issue: safety notice first, then pick the room, check what's
// already reported there, and describe the problem (photo optional).
// Optionally, say which lift, stairs or door it is about (MAP_NOTES.md,
// spec 3): the staff who handle it can then mark that one out of order.
// The report itself never closes anything. Links from the indoor map fill
// that in (?target=connector:<id>&floor=G); ?room= is used when that room
// is in the list.
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
import { useFloors, useRooms } from '@/features/map/hooks';
import { roomLabel } from '@/features/map/logic';
import { useConnectors, useGeometry, useTracedRooms } from '@/features/map/nav/hooks';
import { errorMessage } from '@/lib/errors';
import { isStaff } from '@/lib/permissions';
import { DuplicateCheck } from '../components/DuplicateCheck';
import { mapTargetOptions } from '../mapTargets';
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
    mapTarget: params.get('target') ?? '',
  });
  const [errors, setErrors] = useState<ReportFormErrors>({});

  // A room from the address that isn't in the list (a traced room, before
  // the room lists switch over) is dropped: the student picks one instead.
  if (rooms.data && values.roomId && !rooms.data.some((room) => room.id === values.roomId)) {
    setValues((current) => ({ ...current, roomId: '' }));
  }

  // What the lift, stairs or door choices depend on: the room's floor (old
  // floor names G, 1, 2 are the map's floor ids) and, for a traced room, its doors.
  const floors = useFloors();
  const connectors = useConnectors();
  const tracedRooms = useTracedRooms();
  const room = rooms.data?.find((r) => r.id === values.roomId);
  const floorName =
    floors.data?.find((f) => f.id === room?.floor_id)?.name ?? params.get('floor') ?? null;
  const region = values.roomId ? tracedRooms.data?.[values.roomId] : undefined;
  const geometry = useGeometry(Boolean(region));
  const doors = region
    ? (geometry.data?.doors ?? []).filter((door) => door.a === region || door.b === region)
    : [];
  const targetOptions = mapTargetOptions(connectors.data ?? [], floorName, doors, values.mapTarget);

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

      {/* Tablets and laptops: where it is (and reports already open there) on
          the left, what's wrong on the right. On a phone, one after the other. */}
      <form className={`stack ${styles.columns}`} onSubmit={handleSubmit} noValidate>
        <div className="stack">
          <SelectField
            label="Where is it?"
            value={values.roomId}
            onChange={(e) => update('roomId', e.target.value)}
            error={errors.roomId}
          >
            <option value="">Choose a room…</option>
            {rooms.data?.map((room) => (
              <option key={room.id} value={room.id}>
                {roomLabel(room)}
              </option>
            ))}
          </SelectField>

          {values.roomId && <DuplicateCheck roomId={values.roomId} />}

          {(targetOptions.length > 0 || values.mapTarget) && (
            <SelectField
              label="Is it about a lift, stairs or a door? (optional)"
              hint="Staff decide whether it is out of order; your report doesn't close it."
              value={values.mapTarget}
              onChange={(e) => update('mapTarget', e.target.value)}
            >
              <option value="">No</option>
              {targetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          )}
        </div>

        <div className="stack">
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
          <Button type="submit" fullWidth loading={create.isPending}>
            Send report
          </Button>
          <p className="meta">
            Other students see the problem, not who reported it. Staff can see who reported it.
          </p>
        </div>
      </form>
    </div>
  );
}
