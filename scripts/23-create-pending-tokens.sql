-- Create pending_tokens table for Telegram bot authentication
-- This table stores temporary tokens during the auth flow

CREATE TABLE IF NOT EXISTS pending_tokens (
  token text PRIMARY KEY,
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT NOW(),
  used boolean DEFAULT false,
  
  -- Security tracking (ChatGPT suggestion)
  ip_address inet,
  user_agent text,
  origin text,
  
  -- Telegram user info for debugging
  telegram_chat_id bigint,
  telegram_username text,
  telegram_first_name text
);

-- Index for cleanup job
CREATE INDEX IF NOT EXISTS idx_pending_tokens_expires_at ON pending_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_tokens_created_at ON pending_tokens(created_at);

-- RLS policy (only service role can access)
ALTER TABLE pending_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (this table is for internal auth flow only)
CREATE POLICY "Service role only" ON pending_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Cleanup function to remove expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM pending_tokens 
  WHERE expires_at < NOW() 
     OR created_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Comment explaining the table
COMMENT ON TABLE pending_tokens IS 'Temporary storage for Telegram bot authentication tokens. Tokens expire after 10 minutes or when used.';
