ALTER TABLE push_subscriptions 
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS device_token text;

ALTER TABLE push_subscriptions ALTER COLUMN endpoint DROP NOT NULL;
ALTER TABLE push_subscriptions ALTER COLUMN p256dh_key DROP NOT NULL;
ALTER TABLE push_subscriptions ALTER COLUMN auth_key DROP NOT NULL;

ALTER TABLE push_subscriptions ALTER COLUMN endpoint SET DEFAULT '';
ALTER TABLE push_subscriptions ALTER COLUMN p256dh_key SET DEFAULT '';
ALTER TABLE push_subscriptions ALTER COLUMN auth_key SET DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_device_token_idx 
  ON push_subscriptions(user_id, device_token) WHERE device_token IS NOT NULL;