// Files attached to a project, in the private `project-files` bucket.
// Downloads use signed links that expire after a minute.
import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { FormError } from '@/components/Input';
import { ErrorState, LoadingState } from '@/components/States';
import { errorMessage } from '@/lib/errors';
import {
  useAttachments,
  useDeleteAttachment,
  useOpenAttachment,
  useUploadAttachment,
} from '../hooks';
import styles from './Attachments.module.css';

const MAX_BYTES = 10 * 1024 * 1024; // matches the bucket's file_size_limit

export function Attachments({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const files = useAttachments(projectId);
  const upload = useUploadAttachment(projectId);
  const remove = useDeleteAttachment();
  const open = useOpenAttachment();
  const input = useRef<HTMLInputElement>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  function clearPicker() {
    // Lets the same file be picked again after an error.
    if (input.current) input.current.value = '';
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setSizeError('Files can be up to 10 MB.');
      clearPicker();
      return;
    }
    setSizeError(null);
    upload.mutate(file, { onSettled: clearPicker });
  }

  const failure = upload.error ?? remove.error ?? open.error;
  const error = sizeError ?? (failure ? errorMessage(failure) : null);

  return (
    <Card className="stack-tight">
      {files.isPending && <LoadingState label="Loading files…" />}
      {files.isError && <ErrorState error={files.error} onRetry={() => files.refetch()} />}
      {files.data?.length === 0 && <p className="meta">No files attached.</p>}
      {files.data && files.data.length > 0 && (
        <ul className={styles.list}>
          {files.data.map((file) => (
            <li key={file.path} className={styles.file}>
              <button type="button" className={styles.open} onClick={() => open.mutate(file.path)}>
                <Icon name="paperclip" size={18} />
                {file.name}
              </button>
              {canEdit && (
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove ${file.name}`}
                  onClick={() => remove.mutate(file.path)}
                >
                  <Icon name="trash" size={18} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <FormError message={error} />
      {canEdit && (
        <>
          <input
            ref={input}
            type="file"
            className="visually-hidden"
            id={`attach-${projectId}`}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button
            variant="secondary"
            icon="paperclip"
            loading={upload.isPending}
            onClick={() => input.current?.click()}
          >
            Attach a file
          </Button>
        </>
      )}
    </Card>
  );
}
