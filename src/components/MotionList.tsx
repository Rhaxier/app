// A list whose items fade and slide in when they arrive after the first load,
// and fade out when they're removed (see src/lib/useListMotion.ts):
//
//   <MotionList items={requests} keyOf={(r) => r.id} className="stack-tight">
//     {(request) => <RequestCard request={request} />}
//   </MotionList>
import type { ReactNode } from 'react';
import { useListMotion } from '@/lib/useListMotion';

interface MotionListProps<T> {
  items: T[] | undefined;
  keyOf: (item: T) => string;
  children: (item: T) => ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function MotionList<T>({ items, keyOf, children, className, ...rest }: MotionListProps<T>) {
  const rows = useListMotion(items, keyOf);
  return (
    <ul className={className} aria-label={rest['aria-label']}>
      {rows.map(({ item, key, motion }) => (
        <li key={key} className={motion || undefined}>
          {children(item)}
        </li>
      ))}
    </ul>
  );
}
