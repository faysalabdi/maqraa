-- Apple IAP (RevenueCat) joins Stripe as a subscription source. One row per
-- user regardless of provider; getPlan only reads status + current_period_end.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS rc_original_transaction_id text;
