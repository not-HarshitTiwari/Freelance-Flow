-- Adds a configurable per-user cadence (in days) for overdue payment reminder emails.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reminder_cadence_days integer NOT NULL DEFAULT 3;
