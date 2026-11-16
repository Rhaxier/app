// The term bar: which set of room names is being edited, which one students
// see, and the actions on terms. The editor always edits the term chosen
// here, which may not be the active one; a badge says so, so nobody thinks
// students can already see what they are typing.
//
// "Make active" is one database call (map_set_active_preset) behind a
// confirm, because it changes what every student sees at once.
import { useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormError, SelectField, TextField } from '@/components/Input';
import { Sheet } from '@/components/Sheet';
import type { Preset } from '@/features/map/nav/api';
import {
  useCreatePreset,
  useDeletePreset,
  useRenamePreset,
  useSetActivePreset,
} from '@/features/map/nav/hooks';
import { errorMessage } from '@/lib/errors';
import { footnotes } from '../../strings';
import styles from './MapRooms.module.css';

interface TermBarProps {
  presets: Preset[];
  activeId: string | null;
  selectedId: string;
  onSelect: (id: string) => void;
}

export function TermBar({ presets, activeId, selectedId, onSelect }: TermBarProps) {
  const [sheet, setSheet] = useState<'new' | 'rename' | null>(null);
  const [confirm, setConfirm] = useState<'activate' | 'delete' | null>(null);
  const activate = useSetActivePreset();
  const remove = useDeletePreset();
  const selected = presets.find((preset) => preset.id === selectedId);
  const isActive = selectedId === activeId;

  return (
    <section className="stack-tight" aria-label="Term">
      <div className={styles.bar}>
        <SelectField
          label="Term"
          hint={footnotes.mapRooms.terms}
          value={selectedId}
          onChange={(event) => onSelect(event.target.value)}
        >
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.id === activeId ? `${preset.name} (active)` : preset.name}
            </option>
          ))}
        </SelectField>
        <Button variant="secondary" size="small" icon="plus" onClick={() => setSheet('new')}>
          New term
        </Button>
        <Button variant="secondary" size="small" icon="edit" onClick={() => setSheet('rename')}>
          Rename
        </Button>
        {!isActive && (
          <Button size="small" icon="check" onClick={() => setConfirm('activate')}>
            Make active
          </Button>
        )}
        <Button
          variant="quiet"
          size="small"
          icon="trash"
          disabled={isActive}
          title={isActive ? footnotes.mapRooms.deleteActive : undefined}
          onClick={() => setConfirm('delete')}
        >
          Delete
        </Button>
      </div>
      <div className={styles.status} aria-live="polite">
        {isActive ? (
          <Badge tone="good">Active: students see these names</Badge>
        ) : (
          <Badge tone="attention">Editing a term that is not active</Badge>
        )}
        {isActive && <span className="meta">{footnotes.mapRooms.deleteActive}</span>}
      </div>

      <Sheet
        open={sheet !== null}
        title={sheet === 'new' ? 'New term' : `Rename ${selected?.name ?? 'term'}`}
        onClose={() => setSheet(null)}
      >
        {sheet === 'new' && (
          <NewTermForm
            presets={presets}
            copyFromDefault={selectedId}
            onDone={(id) => {
              setSheet(null);
              onSelect(id);
            }}
          />
        )}
        {sheet === 'rename' && selected && (
          <RenameForm preset={selected} onDone={() => setSheet(null)} />
        )}
      </Sheet>

      <ConfirmDialog
        open={confirm === 'activate'}
        title={`Make ${selected?.name ?? 'this term'} active?`}
        confirmLabel="Make active"
        tone="primary"
        busy={activate.isPending}
        error={activate.isError ? errorMessage(activate.error) : null}
        onConfirm={() =>
          activate.mutate(selectedId, {
            onSuccess: () => setConfirm(null),
          })
        }
        onClose={() => setConfirm(null)}
      >
        <p>Students will see {selected?.name ?? 'this term'} room names straight away.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'delete'}
        title={`Delete ${selected?.name ?? 'this term'}?`}
        confirmLabel="Delete term"
        busy={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onConfirm={() =>
          remove.mutate(selectedId, {
            onSuccess: () => {
              setConfirm(null);
              const next = presets.find((preset) => preset.id !== selectedId);
              if (next) onSelect(next.id);
            },
          })
        }
        onClose={() => setConfirm(null)}
      >
        <p>Its room names are removed from the app and kept in the audit log.</p>
      </ConfirmDialog>
    </section>
  );
}

function NewTermForm({
  presets,
  copyFromDefault,
  onDone,
}: {
  presets: Preset[];
  copyFromDefault: string;
  onDone: (id: string) => void;
}) {
  const create = useCreatePreset();
  const [name, setName] = useState('');
  const [copyFrom, setCopyFrom] = useState(copyFromDefault);
  const [error, setError] = useState<string | undefined>();

  function submit() {
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Give the term a name, for example “Term 2”.');
      return;
    }
    if (presets.some((preset) => preset.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`There is already a term called “${trimmed}”.`);
      return;
    }
    setError(undefined);
    create.mutate({ name: trimmed, copyFrom: copyFrom || undefined }, { onSuccess: onDone });
  }

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextField
        label="Name"
        placeholder="Term 2"
        maxLength={40}
        value={name}
        error={error}
        autoFocus
        onChange={(event) => setName(event.target.value)}
      />
      <SelectField
        label="Copy from"
        hint={footnotes.mapRooms.copyFrom}
        value={copyFrom}
        onChange={(event) => setCopyFrom(event.target.value)}
      >
        <option value="">Start empty</option>
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </SelectField>
      <FormError message={create.isError ? errorMessage(create.error) : null} />
      <Button type="submit" fullWidth loading={create.isPending}>
        Create term
      </Button>
    </form>
  );
}

function RenameForm({ preset, onDone }: { preset: Preset; onDone: () => void }) {
  const rename = useRenamePreset();
  const [name, setName] = useState(preset.name);
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        rename.mutate({ id: preset.id, name: name.trim() }, { onSuccess: onDone });
      }}
    >
      <TextField
        label="Name"
        maxLength={40}
        value={name}
        autoFocus
        onChange={(event) => setName(event.target.value)}
      />
      <FormError message={rename.isError ? errorMessage(rename.error) : null} />
      <Button type="submit" fullWidth loading={rename.isPending} disabled={name.trim() === ''}>
        Save name
      </Button>
    </form>
  );
}
