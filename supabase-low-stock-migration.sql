-- Low-stock email alerts: per-product threshold + throttle timestamp
ALTER TABLE public.products_services
  ADD COLUMN IF NOT EXISTS low_stock_threshold numeric(12,2) NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS low_stock_alert_sent_at timestamptz;
