-- Adds recurring-expense support, mirroring the existing recurring-invoice columns.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_interval text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS next_expense_date date;
