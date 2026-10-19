// "Me too · 3": adds (or removes) your vote, so a problem is counted once per
// person instead of being reported again. The reporter's own report already
// counts them.
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
      disabled={reportedByMe || toggle.isPending}
      aria-pressed={votedByMe}
      title={reportedByMe ? 'You reported this one' : undefined}
      onClick={() => toggle.mutate({ reportId, voted: votedByMe })}
    >
      {votedByMe ? 'You said me too' : 'Me too'} · {count}
    </Button>
  );
}
