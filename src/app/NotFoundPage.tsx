// Any address that doesn't match a screen.
import { ButtonLink } from '@/components/Button';
import { EmptyState } from '@/components/States';

export function NotFoundPage() {
  return (
    <EmptyState
      icon="search"
      title="Page not found"
      action={
        <ButtonLink to="/" variant="secondary" size="small">
          Go home
        </ButtonLink>
      }
    >
      The link may be old, or the item may have been removed.
    </EmptyState>
  );
}
