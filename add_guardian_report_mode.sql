ALTER TABLE students
ADD COLUMN IF NOT EXISTS guardian_report_mode TEXT NOT NULL DEFAULT 'daily';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'students_guardian_report_mode_check'
  ) THEN
    ALTER TABLE students
    ADD CONSTRAINT students_guardian_report_mode_check
    CHECK (guardian_report_mode IN ('daily', 'weekly', 'none'));
  END IF;
END $$;
