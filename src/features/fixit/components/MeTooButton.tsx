// "Me too · 3": adds (or removes) your vote, so a problem is counted once per
// person instead of being reported again. The reporter's own report already
// counts them. The count changes the moment you tap (an optimistic update,
// see useToggleVote) and goes back if the database refuses.
import { Button } from '@/components/Button';
import { useCurrentUser } from '@/features/auth/hooks';
import { useToggleVote } from '../hooks';

interface MeTooButtonProps {
  reportId: string;
  count: number;
  votedByMe: boolean;
  reportedByMe: boolean;
  fullWidth?: boolean;
}

export function MeTooButton({
  reportId,
  count,
  votedByMe,
  reportedByMe,
  fullWidth,
}: MeTooButtonProps) {
  const user = useCurrentUser();
  const toggle = useToggleVote(user.id);
  return (
    <Button
      variant={votedByMe ? 'quiet' : 'secondary'}
      fullWidth={fullWidth}
      disabled={reportedByMe}
      aria-pressed={votedByMe}
      title={reportedByMe ? 'You reported this one' : undefined}
      // One tap at a time: a second tap waits for the first to finish.
      onClick={() => !toggle.isPending && toggle.mutate({ reportId, voted: votedByMe })}
    >
      {votedByMe ? 'You said me too' : 'Me too'} · {count}
    </Button>
  );
}
