// One section of the Approvals queue, with a count. Hidden when empty, so the
// queue only shows what's actually waiting.
import type { ReactNode } from 'react';
import { Badge } from '@/components/Badge';
import { SectionHeader } from '@/components/PageHeader';

interface SectionProps {
  id: string;
  title: string;
  count: number;
  children: ReactNode;
}

export function Section({ id, title, count, children }: SectionProps) {
  if (count === 0) return null;
  return (
    <section className="stack-tight" aria-labelledby={id}>
      <SectionHeader id={id} title={title} action={<Badge tone="attention">{count}</Badge>} />
      {children}
    </section>
  );
}
