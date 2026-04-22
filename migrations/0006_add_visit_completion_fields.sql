-- Migration 0006: add explicit completion fields to visits table
--
-- completed_at    — ISO-8601 timestamp set when an engineer formally completes
--                   the visit via the "Complete Visit" button in the PWA.
-- completion_method — e.g. 'manual_pwa', 'auto_survey' — records how the
--                     visit was closed out.

ALTER TABLE visits ADD COLUMN completed_at TEXT;
ALTER TABLE visits ADD COLUMN completion_method TEXT;
