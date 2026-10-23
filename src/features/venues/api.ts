// Venue booking: raw Supabase calls. Rules are in
// supabase/migrations/20261019120800_venues.sql. Two things to know:
//
// 1. Two ways to read bookings. Straight from the `bookings` table everyone
//    gets only the calendar columns (what, where, when, status), and only
//    approved rows plus the ones they're involved in. booking_details() adds
//    who asked, why and the review note, for the people involved and venue staff.
// 2. Every screen reads the same table, and Realtime tells them when it
//    changes, so an approval shows up everywhere at once.
import { supabase } from '@/lib/supabase';
import type { Enums, Tables, TablesInsert } from '@/types/database';

export type BookingStatus = Enums<'booking_status'>;

export type Venue = Pick<
  Tables<'venues'>,
  | 'id'
  | 'name'
  | 'capacity'
  | 'needs_approval'
  | 'active'
  | 'room_id'
  | 'bookable_from'
  | 'bookable_until'
  | 'max_booking_minutes'
  | 'max_days_ahead'
> & {
  room: { code: string; floor_id: string } | null;
};

export async function fetchVenues(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select(
      'id, name, capacity, needs_approval, active, room_id, bookable_from, bookable_until, max_booking_minutes, max_days_ahead, room:rooms(code, floor_id)',
    )
    .order('name');
  if (error) throw error;
  return data;
}

/** The public view of a booking: enough to draw a calendar. */
export interface CalendarBooking {
  id: string;
  venue_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
}

/** Approved bookings overlapping [from, to), for one venue or all of them. */
export async function fetchApprovedBookings(
  from: string,
  to: string,
  venueId?: string,
): Promise<CalendarBooking[]> {
  let query = supabase
    .from('bookings')
    .select('id, venue_id, title, starts_at, ends_at, status')
    .eq('status', 'approved')
    // Overlap test: starts before the window ends, ends after it starts.
    .lt('starts_at', to)
    .gt('ends_at', from)
    .order('starts_at');
  if (venueId) query = query.eq('venue_id', venueId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export interface BookingDetails {
  id: string;
  venue_id: string;
  venue_name: string;
  requester_id: string;
  requester_name: string;
  requester_role: Enums<'user_role'>;
  supervising_teacher_id: string | null;
  supervising_teacher_name: string | null;
  title: string;
  purpose: string;
  expected_attendance: number | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  reviewed_by: string | null;
  review_note: string | null;
  announce: boolean;
  created_at: string;
  /** Other requests waiting for an overlapping slot in the same venue. */
  overlaps_pending: number;
}

/**
 * Full details of bookings you're involved in (or all, for venue staff).
 * It's a function, so filters like .eq() apply to its result rows.
 */
export function bookingDetails() {
  return supabase.rpc('booking_details');
}

/** Requests still waiting (pending or awaiting a teacher) in [from, to) for a venue. */
export async function fetchWaitingRequests(
  venueId: string,
  from: string,
  to: string,
): Promise<BookingDetails[]> {
  const { data, error } = await bookingDetails()
    .eq('venue_id', venueId)
    .in('status', ['pending', 'awaiting_teacher'])
    .lt('starts_at', to)
    .gt('ends_at', from);
  if (error) throw error;
  return data;
}

/** Your own requests, newest event first. */
export async function fetchMyBookings(userId: string): Promise<BookingDetails[]> {
  const { data, error } = await bookingDetails()
    .eq('requester_id', userId)
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Student requests waiting for this teacher to confirm as supervisor. */
export async function fetchToSupervise(userId: string): Promise<BookingDetails[]> {
  const { data, error } = await bookingDetails()
    .eq('supervising_teacher_id', userId)
    .eq('status', 'awaiting_teacher')
    .order('starts_at');
  if (error) throw error;
  return data;
}

/** The venue staff queue: pending requests, soonest event first. */
export async function fetchPendingForReview(): Promise<BookingDetails[]> {
  const { data, error } = await bookingDetails().eq('status', 'pending').order('starts_at');
  if (error) throw error;
  return data;
}

export type BookingInput = Pick<
  TablesInsert<'bookings'>,
  | 'venue_id'
  | 'title'
  | 'purpose'
  | 'expected_attendance'
  | 'starts_at'
  | 'ends_at'
  | 'supervising_teacher_id'
>;

/**
 * The database decides the starting status: awaiting_teacher for students,
 * pending for staff, approved at once for venues that don't need approval.
 */
export async function requestBooking(
  input: BookingInput,
): Promise<{ id: string; status: BookingStatus }> {
  const { data, error } = await supabase
    .from('bookings')
    .insert(input)
    .select('id, status')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Every decision is a status change; the database checks who may make it:
 *   supervising teacher  awaiting_teacher → pending | rejected
 *   venue staff          pending → approved | rejected, any → cancelled
 *   requester            → cancelled
 */
export async function decideBooking(
  id: string,
  status: Extract<BookingStatus, 'pending' | 'approved' | 'rejected' | 'cancelled'>,
  options: { note?: string; announce?: boolean } = {},
): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({
      status,
      ...(options.note !== undefined ? { review_note: options.note || null } : {}),
      ...(options.announce !== undefined ? { announce: options.announce } : {}),
    })
    .eq('id', id);
  if (error) throw error;
}

/** Calls onChange whenever any booking the person can see changes (Realtime). */
export function subscribeToBookings(onChange: () => void): () => void {
  const channel = supabase
    .channel(`bookings:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
