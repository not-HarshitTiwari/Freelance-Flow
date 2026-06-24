-- Add SMTP fields and proposal content update support
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS smtp_email text,
  ADD COLUMN IF NOT EXISTS smtp_password text;
