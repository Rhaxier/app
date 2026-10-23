// A list of names an admin manages: skill tags, volunteering categories.
// Add, rename, and retire or bring back. Retiring (active = off) instead of
// deleting keeps everything that already uses the name intact.
import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/Input';
import styles from '../pages/ListPage.module.css';

export interface NamedItem {
  id: string;
  name: string;
  active: boolean;
}

interface NameListEditorProps {
  items: NamedItem[];
  /** "skill", "category": used in labels. */
  noun: string;
  busy: boolean;
  onAdd: (name: string) => void;
  onRename: (item: NamedItem, name: string) => void;
  onSetActive: (item: NamedItem, active: boolean) => void;
}

export function NameListEditor({
  items,
  noun,
  busy,
  onAdd,
  onRename,
  onSetActive,
}: NameListEditorProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  function add(event: FormEvent) {
    event.preventDefault();
    const problem = nameProblem(name, items, null);
    setError(problem);
    if (!problem) {
      onAdd(name.trim());
      setName('');
    }
  }

  return (
    <div className="stack-tight">
      <ul>
        {items.map((item) =>
          renaming === item.id ? (
            <RenameRow
              key={item.id}
              item={item}
              items={items}
              onCancel={() => setRenaming(null)}
              onSave={(newName) => {
                onRename(item, newName);
                setRenaming(null);
              }}
            />
          ) : (
            <li key={item.id} className={styles.row}>
              <span className={styles.rowTitle}>
                {item.name} {!item.active && <Badge tone="quiet">Retired</Badge>}
              </span>
              <span className="row">
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Rename ${item.name}`}
                  onClick={() => setRenaming(item.id)}
                >
                  <Icon name="edit" size={18} />
                </button>
                <Button
                  size="small"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => onSetActive(item, !item.active)}
                >
                  {item.active ? 'Retire' : 'Bring back'}
                </Button>
              </span>
            </li>
          ),
        )}
      </ul>
      <form className={styles.addRow} onSubmit={add} noValidate>
        <TextField
          label={`Add a ${noun}`}
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error ?? undefined}
        />
        <Button type="submit" variant="secondary" disabled={busy}>
          Add
        </Button>
      </form>
    </div>
  );
}

function RenameRow({
  item,
  items,
  onCancel,
  onSave,
}: {
  item: NamedItem;
  items: NamedItem[];
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(item.name);
  const problem = nameProblem(name, items, item.id);
  return (
    <li className={styles.addRow}>
      <TextField
        label={`New name for ${item.name}`}
        autoFocus
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={problem ?? undefined}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      />
      <Button variant="secondary" disabled={Boolean(problem)} onClick={() => onSave(name.trim())}>
        Save
      </Button>
    </li>
  );
}

/** Names are required, short, and unique (ignoring capitals). */
function nameProblem(name: string, items: NamedItem[], ignoreId: string | null): string | null {
  const value = name.trim();
  if (!value) return 'Type a name.';
  if (items.some((i) => i.id !== ignoreId && i.name.toLowerCase() === value.toLowerCase()))
    return 'That name is already on the list.';
  return null;
}
