-- Migration 0003: add visit_id to reports table
--
-- Links report rows to their parent visit/case record.
-- Nullable so that legacy reports (created before this migration) remain valid.

ALTER TABLE reports ADD COLUMN visit_id TEXT REFERENCES visits(id);
