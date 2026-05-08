-- Story 9.4 introduces system-emitted analytics rows (Resend webhook bounce +
-- complaint events) where the originating user/org cannot be recovered from
-- the webhook payload. Relax both columns to nullable so trackEventSystem can
-- write rows with NULL context. FK constraints stay; tenant-scoped consumers
-- still cannot see NULL-org rows because the existing RLS policy filters on
-- org_id = current_setting('app.current_org_id'), which excludes NULL.

ALTER TABLE "analytics_events" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "analytics_events" ALTER COLUMN "org_id" DROP NOT NULL;
