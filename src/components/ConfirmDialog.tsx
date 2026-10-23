// "Are you sure?" before anything destructive: deleting, archiving, removing
// someone's access. Built on Sheet, so it animates and handles focus the same.
//
// For the biggest actions (year-end rollover, deleting someone's data) pass
// `typeToConfirm`: the button stays disabled until those exact words are typed,
// so it can't happen with a stray tap.
import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { FormError, TextField } from './Input';
import { Sheet } from './Sheet';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in plain words. */
  children: ReactNode;
  confirmLabel: string;
  /** Words the person must type exactly, e.g. "ROLLOVER 2027". */
  typeToConfirm?: string;
  /** 'alert' (orange) for destructive actions, 'primary' otherwise. */
  tone?: 'alert' | 'primary';
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  typeToConfirm,
  tone = 'alert',
  busy = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  // Start empty each time the dialog opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTyped('');
  }
  const ready = !typeToConfirm || typed.trim() === typeToConfirm;

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="stack-tight">{children}</div>
      {typeToConfirm && (
        <TextField
          label={`Type ${typeToConfirm} to confirm`}
          value={typed}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setTyped(event.target.value)}
        />
      )}
      <FormError message={error} />
      <div className="stack-tight">
        <Button variant={tone} fullWidth disabled={!ready} loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" fullWidth onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
