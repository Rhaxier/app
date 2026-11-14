// Admin > Features > Fix-it categories (Q1). What people can report, the icon
// for each, and which team gets it (everyone holding that responsibility is
// notified). Categories are retired rather than deleted: old reports keep
// theirs. Also the auto-urgent threshold: enough "me too" makes a report urgent.
import { useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, ICON_NAMES, type IconName } from '@/components/Icon';
import { FormError, SelectField, TextField } from '@/components/Input';
import { Sheet } from '@/components/Sheet';
import { ErrorState, LoadingState } from '@/components/States';
import { Switch } from '@/components/Switch';
import type { ReportCategoryRow } from '@/features/fixit/api';
import { useReportCategories, useSaveReportCategory } from '@/features/fixit/hooks';
import { errorMessage } from '@/lib/errors';
import { responsibilityLabel } from '@/lib/status';
import { Constants } from '@/types/database';
import type { Responsibility } from '../api';
import { AdminPage } from '../components/AdminPage';
import { footnotes, pageIntros } from '../strings';
import { SettingNumber } from '../components/SettingControls';
import { categoryKey, validateReportCategory } from '../logic';
import styles from './ListPage.module.css';

const kinds = Constants.public.Enums.responsibility_kind as readonly Responsibility[];
// Icons that make sense for a problem.
const categoryIcons: IconName[] = [
  'bolt',
  'wind',
  'droplet',
  'box',
  'monitor',
  'sparkle',
  'camera',
  'alert',
  'settings',
];

const iconOf = (name: string): IconName =>
  (ICON_NAMES as string[]).includes(name) ? (name as IconName) : 'alert';

export function ReportCategoriesPage() {
  const categories = useReportCategories();
  const [editing, setEditing] = useState<ReportCategoryRow | null | undefined>(undefined);

  return (
    <AdminPage
      title="Fix-it categories"
      description={pageIntros['report-categories']}
      actions={
        <Button size="small" icon="plus" onClick={() => setEditing(null)}>
          Add
        </Button>
      }
    >
      <Card className="stack-tight">
        <SettingNumber
          setting="report_auto_urgent_votes"
          label="Make urgent after this many “me too”"
          hint={footnotes.reportCategories.autoUrgent}
          min={2}
          max={100}
          optional
        />
      </Card>

      {categories.isPending && <LoadingState shape="row" />}
      {categories.isError && (
        <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
      )}
      <Card>
        <ul>
          {categories.data?.map((category) => (
            <li key={category.id} className={styles.row}>
              <button
                type="button"
                className={`${styles.rowButton} pressable`}
                onClick={() => setEditing(category)}
              >
                <span className={`row ${styles.rowTitle}`}>
                  <Icon name={iconOf(category.icon)} size={20} />
                  {category.name}
                  {!category.active && <Badge tone="quiet">Retired</Badge>}
                </span>
                <span className="meta">Sent to {responsibilityLabel[category.responsibility]}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Sheet
        open={editing !== undefined}
        title={editing ? `Edit ${editing.name}` : 'New category'}
        onClose={() => setEditing(undefined)}
      >
        {editing !== undefined && categories.data && (
          <CategoryEditor
            key={editing?.id ?? 'new'}
            category={editing}
            existing={categories.data}
            onDone={() => setEditing(undefined)}
          />
        )}
      </Sheet>
    </AdminPage>
  );
}

function CategoryEditor({
  category,
  existing,
  onDone,
}: {
  category: ReportCategoryRow | null;
  existing: ReportCategoryRow[];
  onDone: () => void;
}) {
  const save = useSaveReportCategory();
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? 'alert');
  const [team, setTeam] = useState<Responsibility>(category?.responsibility ?? 'facilities');
  const [active, setActive] = useState(category?.active ?? true);
  const problem = validateReportCategory(name, existing, category?.id ?? null);

  function submit() {
    if (problem) return;
    save.mutate(
      {
        id: category?.id ?? null,
        fields: {
          // The key never changes once made: reports store it.
          key:
            category?.key ??
            categoryKey(
              name,
              existing.map((c) => c.key),
            ),
          name: name.trim(),
          icon,
          responsibility: team,
          active,
          sort_order: category?.sort_order ?? existing.length + 1,
        },
      },
      { onSuccess: onDone },
    );
  }

  return (
    <>
      <TextField
        label="Name"
        placeholder="Projector"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={name ? (problem ?? undefined) : undefined}
      />
      <fieldset className={styles.fieldset}>
        <legend className="label">Icon</legend>
        <div className="row-wrap" role="group" aria-label="Icon">
          {categoryIcons.map((choice) => (
            <button
              key={choice}
              type="button"
              className={`${styles.iconChoice} pressable`}
              aria-pressed={icon === choice}
              aria-label={choice}
              onClick={() => setIcon(choice)}
            >
              <Icon name={choice} />
            </button>
          ))}
        </div>
      </fieldset>
      <SelectField
        label="Send to"
        hint={footnotes.reportCategories.sendTo}
        value={team}
        onChange={(e) => setTeam(e.target.value as Responsibility)}
      >
        {kinds.map((kind) => (
          <option key={kind} value={kind}>
            {responsibilityLabel[kind]}
          </option>
        ))}
      </SelectField>
      <Switch
        label="In use"
        hint={footnotes.reportCategories.inUse}
        checked={active}
        onChange={setActive}
      />
      <FormError message={save.isError ? errorMessage(save.error) : null} />
      <Button fullWidth disabled={Boolean(problem)} loading={save.isPending} onClick={submit}>
        Save category
      </Button>
    </>
  );
}
