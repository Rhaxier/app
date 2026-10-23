-- =============================================================================
-- 16 A notification type for emergency broadcasts (B6).
--
-- On its own because Postgres won't let a new enum value be used in the same
-- transaction that adds it; the next migration uses it.
-- =============================================================================
alter type public.notification_type add value if not exists 'emergency';
