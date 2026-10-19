// The sheet that opens from "Sign up": an optional note for the organiser.
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { FormError, TextArea } from '@/components/Input';
import { Sheet } from '@/components/Sheet';

interface SignUpSheetProps {
  roleName: string | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (note: string) => void;
  onClose: () => void;
}

export function SignUpSheet({ roleName, submitting, error, onSubmit, onClose }: SignUpSheetProps) {
  const [note, setNote] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(note);
  }

  return (
    <Sheet open={roleName !== null} title={`Sign up: ${roleName ?? ''}`} onClose={onClose}>
      <form className="stack-tight" onSubmit={handleSubmit}>
        <TextArea
          label="Note for the organiser (optional)"
          hint="Anything useful, e.g. relevant experience or times you can't make."
          rows={3}
          maxLength={300}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" fullWidth loading={submitting}>
          Sign up
        </Button>
      </form>
    </Sheet>
  );
}
