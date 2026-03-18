-- Migration 0004: add visit_reference column to visits table
--
-- Adds an optional user-defined reference (e.g. lead number or job number)
-- so users can recognise and search visits more easily without relying on
-- address or customer identity alone.

ALTER TABLE visits ADD COLUMN visit_reference TEXT;
