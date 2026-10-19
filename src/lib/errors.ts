// Turns database errors into sentences a student can act on.
// Our own triggers raise readable messages already; this handles the
// built-in Postgres ones (permissions, duplicates, clashes).

interface DatabaseError {
  message?: string;
  code?: string;
}

export function errorMessage(error: unknown): string {
  if (!error) return 'Something went wrong.';
  const { message = '', code = '' } = error as DatabaseError;

  // 42501: Row Level Security or a missing grant refused the request.
  if (code === '42501' || message.includes('row-level security')) {
    return "You don't have permission to do that.";
  }
  // 23505: a unique constraint, e.g. asking to join the same post twice.
  if (code === '23505') return 'That already exists.';
  // 23P01: the no-double-bookings exclusion constraint.
  if (code === '23P01') return 'That time overlaps an approved booking for this venue.';
  // 23514: a CHECK constraint, e.g. an end time before the start time.
  if (code === '23514') return 'Some of the details are not valid. Please check the form.';
  if (message.includes('Failed to fetch')) {
    return "Can't reach the server. Check your connection and try again.";
  }
  // P0001: raised by our own triggers with a message written for people.
  return message || 'Something went wrong.';
}
