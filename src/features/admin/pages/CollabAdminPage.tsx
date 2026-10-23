// Admin > Features > Collab. Team rules (supervising teacher, maximum size),
// the skills list students pick from, and skills students have suggested:
// approve, merge into an existing skill, or reject.
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SelectField } from '@/components/Input';
import { ErrorState, LoadingState } from '@/components/States';
import type { SkillSuggestion } from '@/features/collab/api';
import {
  usePendingSuggestions,
  useReviewSuggestion,
  useSaveSkillTag,
  useSkillTags,
} from '@/features/collab/hooks';
import { relativeTime } from '@/lib/dates';
import { AdminPage } from '../components/AdminPage';
import { NameListEditor } from '../components/NameListEditor';
import { SettingNumber, SettingSwitch } from '../components/SettingControls';
import styles from './ListPage.module.css';

export function CollabAdminPage() {
  const tags = useSkillTags();
  const saveTag = useSaveSkillTag();
  const suggestions = usePendingSuggestions();

  return (
    <AdminPage title="Collab" description="Team rules and the skills students choose from.">
      <Card className="stack-tight">
        <h2 className={styles.cardTitle}>Teams</h2>
        <SettingSwitch
          setting="collab_requires_teacher"
          label="Posts need a supervising teacher"
          hint="Q4. When on, students must choose a teacher before posting."
        />
        <SettingNumber
          setting="collab_max_team_size"
          label="Biggest team (people, including the owner)"
          min={2}
          max={51}
        />
      </Card>

      <Card className="stack-tight">
        <h2 className={styles.cardTitle}>Suggested skills</h2>
        {suggestions.isPending && <LoadingState shape="row" count={1} />}
        {suggestions.isError && (
          <ErrorState error={suggestions.error} onRetry={() => suggestions.refetch()} />
        )}
        {suggestions.data?.length === 0 && <p className="meta">Nothing waiting.</p>}
        <ul>
          {suggestions.data?.map((suggestion) => (
            <SuggestionRow
              key={suggestion.id}
              suggestion={suggestion}
              tags={(tags.data ?? []).filter((t) => t.active)}
            />
          ))}
        </ul>
      </Card>

      <Card className="stack-tight">
        <h2 className={styles.cardTitle}>Skills list</h2>
        <p className="meta">Retired skills stay on old posts but can't be chosen any more.</p>
        {tags.isPending && <LoadingState shape="row" />}
        {tags.data && (
          <NameListEditor
            noun="skill"
            items={tags.data}
            busy={saveTag.isPending}
            onAdd={(name) => saveTag.mutate({ id: null, fields: { name, active: true } })}
            onRename={(tag, name) =>
              saveTag.mutate({ id: tag.id, fields: { name, active: tag.active } })
            }
            onSetActive={(tag, active) =>
              saveTag.mutate({ id: tag.id, fields: { name: tag.name, active } })
            }
          />
        )}
      </Card>
    </AdminPage>
  );
}

function SuggestionRow({
  suggestion,
  tags,
}: {
  suggestion: SkillSuggestion;
  tags: { id: string; name: string }[];
}) {
  const review = useReviewSuggestion();
  const [mergeInto, setMergeInto] = useState('');
  const [rejecting, setRejecting] = useState(false);

  return (
    <li className={`${styles.row} stack-tight`}>
      <div className={styles.rowButton}>
        <span className={styles.rowTitle}>{suggestion.name}</span>
        <span className="meta">
          Suggested by {suggestion.suggester?.full_name ?? 'someone'} ·{' '}
          {relativeTime(suggestion.created_at)}
        </span>
      </div>
      <div className="row-wrap">
        <Button
          size="small"
          disabled={review.isPending}
          onClick={() => review.mutate({ id: suggestion.id, action: 'approve' })}
        >
          Add to the list
        </Button>
        <Button size="small" variant="ghost" onClick={() => setRejecting(true)}>
          Reject
        </Button>
      </div>
      <div className={styles.addRow}>
        <SelectField
          label="Or merge into"
          value={mergeInto}
          onChange={(e) => setMergeInto(e.target.value)}
        >
          <option value="">Choose a skill…</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </SelectField>
        <Button
          variant="secondary"
          disabled={!mergeInto || review.isPending}
          onClick={() => review.mutate({ id: suggestion.id, action: 'merge', mergeInto })}
        >
          Merge
        </Button>
      </div>
      <ConfirmDialog
        open={rejecting}
        title={`Reject "${suggestion.name}"?`}
        confirmLabel="Reject"
        busy={review.isPending}
        onClose={() => setRejecting(false)}
        onConfirm={() =>
          review.mutate(
            { id: suggestion.id, action: 'reject' },
            { onSuccess: () => setRejecting(false) },
          )
        }
      >
        <p>Posts that already use it lose this skill.</p>
      </ConfirmDialog>
    </li>
  );
}
