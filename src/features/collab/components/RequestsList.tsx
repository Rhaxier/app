// The owner's Requests tab: everyone who asked to join, with grade, message,
// status and a Contact button (their school email; in-app chat is version 2).
// Staff see the same list read-only, for safeguarding.
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { FormError } from '@/components/Input';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { errorMessage } from '@/lib/errors';
import { joinRequestStatus } from '@/lib/status';
import { usePostRequests, useSetRequestStatus } from '../hooks';
import styles from './RequestsList.module.css';

interface RequestsListProps {
  postId: string;
  postTitle: string;
  canDecide: boolean;
  isFull: boolean;
}

export function RequestsList({ postId, postTitle, canDecide, isFull }: RequestsListProps) {
  const requests = usePostRequests(postId, true);
  const decide = useSetRequestStatus();

  if (requests.isPending) return <LoadingState label="Loading requests…" />;
  if (requests.isError)
    return <ErrorState error={requests.error} onRetry={() => requests.refetch()} />;
  if (requests.data.length === 0) {
    return (
      <EmptyState icon="users" title="No requests yet">
        When someone asks to join, they'll appear here.
      </EmptyState>
    );
  }

  return (
    <div className="stack-tight">
      <FormError message={decide.isError ? errorMessage(decide.error) : null} />
      {requests.data.map((request) => (
        <Card key={request.request_id} className={styles.request}>
          <div className={styles.top}>
            <div>
              <p className={styles.name}>{request.full_name}</p>
              <p className="meta">{request.grade ? `Grade ${request.grade}` : 'Staff'}</p>
            </div>
            <StatusBadge map={joinRequestStatus} status={request.status} />
          </div>
          {request.message && <p className={styles.message}>“{request.message}”</p>}
          <div className="row-wrap">
            <a
              className={styles.contact}
              href={`mailto:${request.email}?subject=${encodeURIComponent(postTitle)}`}
            >
              <Icon name="mail" size={18} />
              Contact
            </a>
            {canDecide && request.status === 'pending' && (
              <>
                <Button
                  size="small"
                  disabled={decide.isPending || isFull}
                  onClick={() =>
                    decide.mutate({ requestId: request.request_id, status: 'accepted' })
                  }
                >
                  Accept
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({ requestId: request.request_id, status: 'declined' })
                  }
                >
                  Decline
                </Button>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
