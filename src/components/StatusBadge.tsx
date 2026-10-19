// A Badge for a database status, using the shared labels in src/lib/status.ts:
//   <StatusBadge map={bookingStatus} status={booking.status} />
import type { BadgeTone } from './Badge';
import { Badge } from './Badge';

interface StatusBadgeProps<S extends string> {
  map: Record<S, { label: string; tone: BadgeTone }>;
  status: S;
}

export function StatusBadge<S extends string>({ map, status }: StatusBadgeProps<S>) {
  const look = map[status];
  return <Badge tone={look.tone}>{look.label}</Badge>;
}
