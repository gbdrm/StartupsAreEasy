## Telegram Bot Enhancements (Focused Minimal Feature Set)

Goal: Re‑use the existing authentication bot (already handles /start and /help) to: (a) keep basic per‑user messaging capability, and (b) post an automatic announcement to ONE Telegram group whenever a new post or public startup is created on the site. Everything else is deferred. Simplicity, safety (no secret leakage), and low maintenance are the priorities.

---
## Current Bot State
- Bot already exists and is used for sign‑in.
- /start and /help are handled (keep as-is; no new inbound commands now).
- No additional webhook command parsing required today.

---
## Immediate Scope (Build Now)
1. Store & update last_seen_ip and last_seen_at on Telegram auth confirm (best effort real client IP extraction).
2. Maintain telegram_id + simple bot_opt_in flag (already part of profiles or to be added if missing).
3. Direct message capability (Edge Function) kept minimal (may or may not be invoked initially, retained for future growth & manual ops).
4. Automatic Group Announcements: When a new post or a new public startup is created, send a concise formatted message to a configured group chat.

---
## Why Each Piece Exists
| Feature | Why Needed | Risk If Omitted |
|---------|-----------|-----------------|
| last_seen_ip / last_seen_at | Basic operational insight & abuse triage | Harder to trace abuse/spam |
| bot_opt_in flag | Respect user choice / legal courtesy | Can't selectively disable notifications |
| Direct send function | Operational backdoor for future targeted test messages without redesign | Would need new work later for any outbound DM |
| Group announcement on create | Core community visibility driver (immediate feedback loop) | New content less discoverable; group looks idle |

---
## Out of Scope / Deferred
- Weekly or scheduled summaries
- Complex template formatting / markdown buttons
- Per‑category preferences
- Multi‑group broadcasting
- Queues / retries / backoff (single attempt only; failures logged)
- Webhook command expansion (/announce, etc.)
- Analytics dashboards & metrics
- Cron / GitHub Actions automations
- Admin UI; DB edits are manual for now
- Any committed automated tests requiring service role key

---
## Environment Variables
```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ANNOUNCE_GROUP_CHAT_ID=-1001234567890  # target group for announcements
```

Optional later (NOT used now): TELEGRAM_DEV_TEST_CHAT_ID, ENABLE_WEEKLY_SUMMARY, etc.

---
## Minimal Schema (Confirm / Add Only If Missing)
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_ip inet,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp,
  ADD COLUMN IF NOT EXISTS bot_opt_in boolean DEFAULT true;

-- OPTIONAL lightweight log table (keep if already created; otherwise can defer)
CREATE TABLE IF NOT EXISTS bot_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  chat_id bigint,
  message_type text CHECK (message_type IN ('direct','group_announce')),
  content_preview text,
  sent_at timestamp DEFAULT now(),
  success boolean,
  error_text text
);
```

Indexes (optional): user_id, sent_at DESC.

---
## Edge Functions Overview
1. telegram-confirm (existing): augment to set last_seen_ip / last_seen_at.
2. send-direct-message: POST { user_id, text } – minimal; can be retained from previous plan (no expansion required).
3. announce-new-item (NEW): POST { type: 'post' | 'startup', id: '<uuid>' }
   - Validates caller auth (user token in Authorization header) – ensure record.user_id == auth.uid()
   - Loads limited fields from posts/startups tables
   - Builds short message
   - Sends to TELEGRAM_ANNOUNCE_GROUP_CHAT_ID via Telegram API
   - Inserts optional log row

No weekly summary or webhook expansion now.

---
## Group Announcement Message Format
Post (generic / idea / launch – keep uniform):
```
🆕 New post by @username
<truncated content up to ~180 chars>
https://startupsareeasy.com/posts/<id>
```
Startup (public):
```
🚀 New startup: <Name>
<truncated description up to ~180 chars>
https://startupsareeasy.com/startups/<slug>
```
Rules:
- Strip newlines → single spaces.
- Truncate safely at codepoint boundary; append … if truncated.
- Never include raw user-supplied links besides canonical site link.

---
## Trigger Point (Client Flow)
After successful creation (createPostDirect or createStartupDirect) the client performs a fire‑and‑forget fetch to /functions/v1/announce-new-item with the new entity id + type. Errors are swallowed (user flow should not block). This keeps bot outages from breaking posting UX.

Why not send inside existing create functions? Those run client-side; we must keep bot token secret inside Edge Function only.

---
## announce-new-item Function (Pseudo Code)
```ts
// supabase/functions/announce-new-item/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function sendTelegramMessage(token: string, chatId: string|number, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  })
  if(!r.ok) throw new Error(await r.text())
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  let body: any
  try { body = await req.json() } catch { return new Response('Invalid JSON', { status: 400 }) }
  const { type, id } = body || {}
  if (!['post','startup'].includes(type) || !id) return new Response('Invalid payload', { status: 400 })

  // Auth: user JWT forwarded by client (Authorization: Bearer <jwt>)
  const authHeader = req.headers.get('Authorization') || ''
  if(!authHeader.startsWith('Bearer ')) return new Response('Auth required', { status: 401 })

  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: authUser } = await service.auth.getUser(authHeader.replace('Bearer ','').trim())
  if(!authUser) return new Response('Invalid user', { status: 401 })

  let text: string | null = null
  if (type === 'post') {
    const { data } = await service.from('posts').select('id,user_id,content,type').eq('id', id).limit(1)
    const row = data?.[0]
    if(!row || row.user_id !== authUser.user.id) return new Response('Not found', { status: 404 })
    const snippet = (row.content || '').replace(/\s+/g,' ').slice(0,180)
    text = `🆕 New post by user ${authUser.user.id.substring(0,8)}\n${snippet}${snippet.length===180?'…':''}\nhttps://startupsareeasy.com/posts/${row.id}`
  } else {
    const { data } = await service.from('startups').select('id,user_id,name,slug,description,is_public').eq('id', id).limit(1)
    const row = data?.[0]
    if(!row || !row.is_public || row.user_id !== authUser.user.id) return new Response('Not found', { status: 404 })
    const snippet = (row.description || '').replace(/\s+/g,' ').slice(0,180)
    text = `🚀 New startup: ${row.name}\n${snippet}${snippet.length===180?'…':''}\nhttps://startupsareeasy.com/startups/${row.slug}`
  }

  try {
    await sendTelegramMessage(Deno.env.get('TELEGRAM_BOT_TOKEN')!, Deno.env.get('TELEGRAM_ANNOUNCE_GROUP_CHAT_ID')!, text!)
    if (Deno.env.get('LOG_BOT_MESSAGES') === 'true') {
      await service.from('bot_message_logs').insert([{ message_type: 'group_announce', content_preview: text!.slice(0,120), success: true }])
    }
  } catch (e) {
    await service.from('bot_message_logs').insert([{ message_type: 'group_announce', content_preview: text!.slice(0,120), success: false, error_text: String(e) }]).catch(()=>{})
    return new Response('Failed', { status: 502 })
  }
  return new Response('ok')
}
```

Notes:
- Uses service role key in function only (never in client bundle).
- Validates ownership to avoid arbitrary announcements.
- Does not attempt retries.
- Announcement failures are non-blocking for user flow; client ignores error (optional fire‑and‑forget fetch).

---
## Client Integration Snippet (Fire & Forget)
```ts
// After successful create post/startup
fetch('/functions/v1/announce-new-item', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userJwt}` },
  body: JSON.stringify({ type: 'post', id: newPostId })
}).catch(()=>{})
```

Add minimal helper if repetition grows; start inline.

---
## Testing (Manual Only)
1. Create a post as a Telegram‑linked user → verify group receives expected message.
2. Create a startup (public) → verify format.
3. Create private/non‑public (if applicable) → ensure NOT announced.
4. Toggle bot_opt_in=false for user → (still announce group? YES – group announcements ignore per‑user opt‑in; document this) – opt‑in only affects direct messages.
5. Simulate failure: temporarily change TELEGRAM_ANNOUNCE_GROUP_CHAT_ID to invalid ID → ensure function returns 502 and log row stored.

---
## Security Considerations
- Bot token never leaves Edge Functions.
- Service role key only inside functions (not in tests, not in committed client code).
- Ownership check prevents malicious user from announcing random content.
- Content truncated & whitespace-normalized to reduce injection / formatting misuse.

---
## Rollback Simplicity
Delete announce-new-item function + remove fire‑and‑forget call. Schema additions are additive; can leave columns in place. Optional log table can be dropped independently.

---
## Phase Plan
Batch A (≈0.5 day): IP + schema columns (if missing) + confirm existing bot config.
Batch B (≈0.5–1 day): announce-new-item function + client fire‑and‑forget integration + manual tests.
Deferred: Direct DM usage (leave function scaffold), weekly summaries, command expansion, scheduling.

---
## Success Criteria (Lean)
- < 30 min end‑to‑end from post/create to group message.
- < 5% failure rate (observed manually) for announcements.
- Zero exposure of bot token in client code / repo.

---
Version: 3.0
Last Updated: 2025-08-09
Focus: Reuse auth bot + immediate group visibility for new content.

# Telegram Bot Enhancements (Simplified Plan)

> Goal: Add just enough bot functionality to send direct messages to users and a weekly group summary. No admin UI, no complex scheduling engine, minimal schema changes, emphasis on reliability & low risk.

## Guiding Principles
1. Keep schema additions minimal (prefer a few primitive columns over JSON/config tables).
2. Prefer environment variables for rarely changed values (e.g. weekly summary group chat id).
3. Avoid queues & complex retry logic; a single light retry is enough for now.
4. Log successes/failures plainly so manual investigation is easy.
5. Defer anything “nice to have” until there is a demonstrated need.

## Scope (What We WILL Build Now)
- Store the real client IP on login (best‑effort) + last seen timestamp.
- Persist each user’s Telegram chat_id (already present as telegram_id) and a simple boolean to allow/disable bot messages.
- Send a direct message to a user from an Edge Function (single function, single call).
- Send a weekly summary to ONE configured group chat (via cron or external trigger) using a simple text template.

## Out of Scope (Explicitly NOT Building Now)
- Admin dashboard / UI management tools.
- Arbitrary scheduled jobs / per-user schedules.
- Detailed notification preferences (use a single on/off flag now).
- Complex batching / queueing / exponential backoff trees.
- Multi-group management, template versioning, analytics dashboards.

## Minimal Schema Changes
```sql
-- Add only what we need to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_ip inet,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp,
  ADD COLUMN IF NOT EXISTS bot_opt_in boolean DEFAULT true; -- user can toggle off

-- Optional lightweight log (can skip initially; adds traceability)
CREATE TABLE IF NOT EXISTS bot_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id), -- null for group messages
  chat_id bigint,
  message_type text,          -- 'direct' | 'weekly_summary'
  content_preview text,       -- first ~120 chars
  sent_at timestamp DEFAULT now(),
  success boolean,
  error_text text
);

CREATE INDEX IF NOT EXISTS bot_message_logs_user_idx ON bot_message_logs(user_id);
```

That’s it. No group_chats table. Group chat ID stored in an env var.

## Environment Variables
```env
# Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_USERNAME=startups_are_easy_bot

# Weekly Summary
TELEGRAM_WEEKLY_GROUP_CHAT_ID=-1001234567890   # target group
TELEGRAM_WEEKLY_CRON_DAY=monday               # simple day string
TELEGRAM_WEEKLY_CRON_TIME=09:00               # 24h UTC
ENABLE_WEEKLY_SUMMARY=true

# Rate Limiting
TELEGRAM_RATE_LIMIT_MESSAGES_PER_SECOND=20    # Conservative limit
```

## Edge Functions
1. telegram-confirm (already exists) – add IP extraction & store last_seen_ip / last_seen_at.
2. send-direct-message – POST { user_id, text }. Looks up user -> telegram_id -> send -> log.
3. send-weekly-summary – Aggregates minimal stats & posts one multiline message to group.
4. telegram-webhook (new) – Receives bot updates for commands/interactions.

## IP Extraction (Enhanced Light Version)
```ts
function extractClientIP(req: Request): string | null {
  const hdr = (n: string) => req.headers.get(n) || ''
  const candidates = [
    hdr('cf-connecting-ip'),           // Cloudflare (most reliable)
    hdr('x-forwarded-for').split(',')[0].trim(), // Load balancers
    hdr('x-real-ip'),                  // nginx
    hdr('x-client-ip')                 // Other proxies
  ]

  // Basic IP validation
  function isValidIP(ip: string): boolean {
    if (!ip) return false;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255 && !isNaN(num);
    });
  }

  return candidates.find(ip => ip && isValidIP(ip)) || null;
}
```
Store only if present and valid. Simple validation prevents obviously malformed IPs.

## Direct Message Flow (Happy Path)
1. Client (trusted internal action) calls /functions/v1/send-direct-message with service key (or secured server action hitting function).
2. Function validates: user exists, bot_opt_in = true, telegram_id not null.
3. POST to Telegram `sendMessage`.
4. Log success/failure (optionally truncate content).

## Weekly Summary (Minimum Viable)
Content example:
```
Weekly Summary
New ideas: 12
New posts: 34
Active users: 18
Top contributor: @alice (5 posts)
```
Generation logic: one query each (counts) + a simple TOP 1 by posts. No template system—plain string assembly.

Scheduling Options (pick one):
Option A: External (GitHub Action / simple cron hitting Edge Function HTTP endpoint weekly).
Option B: pg_cron (if enabled) calling http_post. (External is simpler to audit—choose A if unsure.)

## Minimal Error Handling
- Direct send: If Telegram API error, return 502 + log row success=false.
- No retries now; manual re-trigger if needed.
- Weekly summary: if failure, log (row with user_id null) and optional simple alert (console / logger.error). Retry manually.

## RLS / Security (Simplest Acceptable)
If functions use the service role key you can bypass RLS. Keep user table policies unchanged. No new policies required unless you expose bot_message_logs to users (not needed now).

## Toggling User Opt-Out
- For now: user can be manually updated in DB (`UPDATE profiles SET bot_opt_in=false WHERE id=...`).
- Future enhancement: simple settings toggle UI.

## Testing Checklist
Direct Message:
- Send to valid user (expect success row).
- Send to user with bot_opt_in=false (expect 400 + no Telegram call).
- Send to user missing telegram_id (expect 400).
Weekly Summary:
- Dry run locally printing message string.
- Ensure counts reasonable vs direct SQL.
- Trigger function twice (should just post twice—no idempotency needed yet).

## Rollback Simplicity
To revert: drop bot_message_logs columns and ignore weekly function. No data coupling.

## Success Indicators (Lean)
- Direct message success rate ≥95% (manual observation of logs).
- Weekly summary posts appear each week (visual check in group).
- Zero production errors crashing Edge Functions (monitor logs).

## Deferred (Captured For Later)
- Per-user notification categories
- Queued / batched sending
- Multi-group support
- Admin broadcast UI
- Rich templates (Markdown buttons, etc.)

## Phase Plan (Lean Estimates)
Phase 1 (0.5 day): Add columns + IP capture tweak.
Phase 2 (0.5–1 day): Direct send function + log table.
Phase 3 (0.5–1 day): Weekly summary function + external cron wiring.

## Bot Setup Prerequisites
Before implementing the functions, ensure bot is properly configured:

1. **Create Bot with @BotFather**:
   - Send `/newbot` to @BotFather
   - Choose name and username
   - Save the bot token

2. **Configure Bot**:
   - Send `/setcommands` to @BotFather
   - Add basic commands: `start`, `help`, `settings`

3. **Get Group Chat ID** (for weekly summaries):
   ```bash
   # Add bot to target group, then:
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates"
   # Look for "chat":{"id":-1001234567890,"type":"supergroup"}
   ```

4. **Set Webhook**:
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -d "url=https://your-project.supabase.co/functions/v1/telegram-webhook"
   ```

## Telegram API Helper Functions
```ts
// lib/telegram-api.ts - Shared Telegram utilities
export class TelegramAPI {
  private botToken: string;
  private rateLimitDelay: number;

  constructor(botToken: string, messagesPerSecond = 20) {
    this.botToken = botToken;
    this.rateLimitDelay = 1000 / messagesPerSecond;
  }

  async sendMessage(chatId: string | number, text: string): Promise<TelegramMessage> {
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Telegram API error: ${error.description}`);
    }

    return await response.json();
  }

  async getMe(): Promise<TelegramBotInfo> {
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
    return await response.json();
  }

  // Simple rate limiting - wait between calls
  async withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    const result = await fn();
    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
    return result;
  }
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  date: number;
}

interface TelegramBotInfo {
  ok: boolean;
  result: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
  };
}
```

## Simple Direct Send Function Sketch
```ts
// supabase/functions/send-direct-message/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TelegramAPI } from '../_shared/telegram-api.ts';

export default async (req: Request) => {
  try {
    const { user_id, text } = await req.json();

    if (!user_id || !text) {
      return new Response('Missing fields: user_id and text required', { status: 400 });
    }

    // Initialize services
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const telegram = new TelegramAPI(Deno.env.get('TELEGRAM_BOT_TOKEN')!);

    // Lookup user
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('telegram_id, bot_opt_in')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      await logMessage(supabase, { user_id, success: false, error_text: 'User not found' });
      return new Response('User not found', { status: 404 });
    }

    if (!user.bot_opt_in) {
      await logMessage(supabase, { user_id, success: false, error_text: 'User opted out' });
      return new Response('User has opted out of bot messages', { status: 403 });
    }

    if (!user.telegram_id) {
      await logMessage(supabase, { user_id, success: false, error_text: 'No telegram_id' });
      return new Response('User has no Telegram ID', { status: 400 });
    }

    // Send message with rate limiting
    const telegramResult = await telegram.withRateLimit(() =>
      telegram.sendMessage(user.telegram_id, text)
    );

    // Log success
    await logMessage(supabase, {
      user_id,
      chat_id: user.telegram_id,
      message_type: 'direct',
      content_preview: text.substring(0, 120),
      success: true
    });

    return new Response(JSON.stringify({
      success: true,
      message_id: telegramResult.message_id
    }));

  } catch (error) {
    console.error('Direct message error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
};

async function logMessage(supabase: any, data: any) {
  await supabase.from('bot_message_logs').insert([{
    sent_at: new Date().toISOString(),
    ...data
  }]);
}
```

## Notes
- Simplicity chosen over theoretical scale; you can layer complexity later without ripping out foundations.
- Keep bot token ONLY in server-side Edge Functions.

---

## Detailed Implementation Plan

### Task 1: Database Schema Setup (30 min)
**Isolation**: Database-only changes, no application code affected

**Steps**:
1. Create migration file: `supabase/migrations/001_telegram_bot_enhancements.sql`
2. Add columns to profiles table
3. Create bot_message_logs table
4. Run migration in development
5. Test rollback capability

**Code**:
```sql
-- Migration: 001_telegram_bot_enhancements.sql
BEGIN;

-- Add new columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_ip inet,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp DEFAULT now(),
  ADD COLUMN IF NOT EXISTS bot_opt_in boolean DEFAULT true;

-- Create logging table
CREATE TABLE IF NOT EXISTS bot_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  chat_id bigint,
  message_type text CHECK (message_type IN ('direct', 'weekly_summary')),
  content_preview text,
  sent_at timestamp DEFAULT now(),
  success boolean NOT NULL,
  error_text text,

  CONSTRAINT content_preview_length CHECK (char_length(content_preview) <= 120)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS bot_message_logs_user_idx ON bot_message_logs(user_id);
CREATE INDEX IF NOT EXISTS bot_message_logs_sent_at_idx ON bot_message_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON profiles(last_seen_at DESC);

COMMIT;
```

**Testing**:
```sql
-- Test data insertion
INSERT INTO profiles (id, telegram_id, last_seen_ip, bot_opt_in)
VALUES (gen_random_uuid(), 123456789, '192.168.1.1', true);

-- Test log insertion
INSERT INTO bot_message_logs (user_id, chat_id, message_type, content_preview, success)
VALUES ((SELECT id FROM profiles LIMIT 1), 123456789, 'direct', 'Test message', true);

-- Verify constraints work
-- This should fail:
INSERT INTO bot_message_logs (message_type, success) VALUES ('invalid_type', true);
```

### Task 2: IP Collection Enhancement (45 min)
**Isolation**: Only modifies existing `telegram-confirm` function

**Steps**:
1. Backup current `telegram-confirm/index.ts`
2. Add IP extraction function
3. Update user profile with IP data
4. Deploy to development
5. Test with real authentication flow

**Code**:
```ts
// Add to supabase/functions/telegram-confirm/index.ts

// Enhanced IP extraction (add near top of file)
function extractClientIP(req: Request): string | null {
  const hdr = (n: string) => req.headers.get(n) || ''
  const candidates = [
    hdr('cf-connecting-ip'),
    hdr('x-forwarded-for').split(',')[0].trim(),
    hdr('x-real-ip'),
    hdr('x-client-ip')
  ]

  function isValidIP(ip: string): boolean {
    if (!ip) return false;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255 && !isNaN(num);
    });
  }

  return candidates.find(ip => ip && isValidIP(ip)) || null;
}

// In main handler, after user creation/update:
// Update the section where profile is created/updated
const clientIP = extractClientIP(req);
const updateData = {
  id: userId,
  telegram_id: chat_id,
  username: username || '',
  first_name: first_name || '',
  ...(clientIP && {
    last_seen_ip: clientIP,
    last_seen_at: new Date().toISOString()
  })
};

const { error: profileUpsertError } = await supabase
  .from('profiles')
  .upsert(updateData);
```

**Testing**:
```bash
# Test IP extraction manually
node -e "
const req = {
  headers: {
    get: (name) => ({
      'cf-connecting-ip': '203.0.113.1',
      'x-forwarded-for': '198.51.100.2, 203.0.113.1',
      'x-real-ip': '192.0.2.1'
    })[name]
  }
};

// Test IP extraction function
console.log('Should extract:', '203.0.113.1');
// Run extraction function here
"
```

### Task 3: Shared Telegram API Library (60 min)
**Isolation**: Creates new shared library, doesn't affect existing code

**Steps**:
1. Create `supabase/functions/_shared/telegram-api.ts`
2. Implement TelegramAPI class
3. Add comprehensive error handling
4. Create test script for API functions
5. Verify rate limiting works

**Code**:
```ts
// supabase/functions/_shared/telegram-api.ts
export class TelegramAPI {
  private botToken: string;
  private rateLimitDelay: number;
  private lastRequestTime: number = 0;

  constructor(botToken: string, messagesPerSecond = 20) {
    this.botToken = botToken;
    this.rateLimitDelay = 1000 / messagesPerSecond;
  }

  async sendMessage(chatId: string | number, text: string): Promise<TelegramMessage> {
    await this.enforceRateLimit();

    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(`Telegram API error: ${result.description || 'Unknown error'}`);
    }

    return result.result;
  }

  async getMe(): Promise<TelegramBotInfo> {
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
    const result = await response.json();

    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }

    return result;
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  date: number;
  text?: string;
}

export interface TelegramBotInfo {
  ok: boolean;
  result: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
  };
}
```

**Testing**:
```ts
// Test script: test-telegram-api.ts
import { TelegramAPI } from '../_shared/telegram-api.ts';

const API_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const TEST_CHAT_ID = Deno.env.get('TELEGRAM_TEST_CHAT_ID')!; // Your own chat ID

async function testTelegramAPI() {
  const telegram = new TelegramAPI(API_TOKEN);

  // Test 1: Bot info
  console.log('Testing getMe()...');
  const botInfo = await telegram.getMe();
  console.log('Bot info:', botInfo.result);

  // Test 2: Send message
  console.log('Testing sendMessage()...');
  const message = await telegram.sendMessage(TEST_CHAT_ID, '🤖 Test message from API');
  console.log('Message sent:', message.message_id);

  // Test 3: Rate limiting (send 3 messages quickly)
  console.log('Testing rate limiting...');
  const start = Date.now();
  await telegram.sendMessage(TEST_CHAT_ID, 'Message 1');
  await telegram.sendMessage(TEST_CHAT_ID, 'Message 2');
  await telegram.sendMessage(TEST_CHAT_ID, 'Message 3');
  const duration = Date.now() - start;
  console.log(`3 messages took ${duration}ms (should be ~150ms with rate limiting)`);
}

if (import.meta.main) {
  testTelegramAPI().catch(console.error);
}
```

### Task 4: Direct Message Function (90 min)
**Isolation**: New Edge Function, doesn't modify existing functionality

**Steps**:
1. Create `supabase/functions/send-direct-message/index.ts`
2. Implement message sending logic
3. Add comprehensive input validation
4. Deploy to development
5. Test all error scenarios

**Code**: (Already provided in enhanced document above)

**Testing**:
```bash
# Test direct message function
curl -X POST "https://your-project.supabase.co/functions/v1/send-direct-message" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your-test-user-uuid",
    "text": "🧪 Test direct message from API"
  }'

# Test error cases
curl -X POST "https://your-project.supabase.co/functions/v1/send-direct-message" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "invalid-uuid", "text": "test"}'

# Verify logs were created
psql -c "SELECT * FROM bot_message_logs ORDER BY sent_at DESC LIMIT 5;"
```

### Task 5: Weekly Summary Function (90 min)
**Isolation**: New Edge Function with simple SQL queries

**Steps**:
1. Create `supabase/functions/send-weekly-summary/index.ts`
2. Implement summary generation logic
3. Test SQL queries independently
4. Deploy function
5. Test manual trigger

**Code**:
```ts
// supabase/functions/send-weekly-summary/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TelegramAPI } from '../_shared/telegram-api.ts';

export default async (req: Request) => {
  try {
    const ENABLED = Deno.env.get('ENABLE_WEEKLY_SUMMARY') === 'true';
    if (!ENABLED) {
      return new Response('Weekly summary disabled', { status: 200 });
    }

    const GROUP_CHAT_ID = Deno.env.get('TELEGRAM_WEEKLY_GROUP_CHAT_ID');
    if (!GROUP_CHAT_ID) {
      return new Response('Group chat ID not configured', { status: 500 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const telegram = new TelegramAPI(Deno.env.get('TELEGRAM_BOT_TOKEN')!);

    // Generate summary data
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartISO = weekStart.toISOString();

    // Simple queries for stats
    const [newIdeas, newPosts, activeUsers, topContributor] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact' })
        .eq('type', 'idea').gte('created_at', weekStartISO),

      supabase.from('posts').select('id', { count: 'exact' })
        .gte('created_at', weekStartISO),

      supabase.from('posts').select('user_id')
        .gte('created_at', weekStartISO)
        .then(result => new Set(result.data?.map(p => p.user_id)).size),

      supabase.rpc('get_top_contributor', { since_date: weekStartISO })
    ]);

    const summary = `
🚀 <b>Weekly Summary</b>

💡 New ideas: ${newIdeas.count || 0}
📝 New posts: ${newPosts.count || 0}
👥 Active users: ${activeUsers}
🏆 Top contributor: ${topContributor.data?.[0]?.username || 'N/A'}

Visit: https://startupsareeasy.com
    `.trim();

    // Send to group
    const messageResult = await telegram.sendMessage(GROUP_CHAT_ID, summary);

    // Log the summary send
    await supabase.from('bot_message_logs').insert([{
      user_id: null, // Group message
      chat_id: parseInt(GROUP_CHAT_ID),
      message_type: 'weekly_summary',
      content_preview: summary.substring(0, 120),
      success: true,
      sent_at: new Date().toISOString()
    }]);

    return new Response(JSON.stringify({
      success: true,
      message_id: messageResult.message_id,
      stats: {
        new_ideas: newIdeas.count,
        new_posts: newPosts.count,
        active_users: activeUsers
      }
    }));

  } catch (error) {
    console.error('Weekly summary error:', error);

    // Log error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      await supabase.from('bot_message_logs').insert([{
        user_id: null,
        chat_id: Deno.env.get('TELEGRAM_WEEKLY_GROUP_CHAT_ID') ?
          parseInt(Deno.env.get('TELEGRAM_WEEKLY_GROUP_CHAT_ID')!) : null,
        message_type: 'weekly_summary',
        content_preview: 'Failed to send weekly summary',
        success: false,
        error_text: error.message,
        sent_at: new Date().toISOString()
      }]);
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(`Error: ${error.message}`, { status: 500 });
  }
};
```

**Testing**:
```bash
# Test weekly summary generation
curl -X POST "https://your-project.supabase.co/functions/v1/send-weekly-summary" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Test with summary disabled
export ENABLE_WEEKLY_SUMMARY=false
curl -X POST "https://your-project.supabase.co/functions/v1/send-weekly-summary" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### Task 6: Comprehensive Test Suite (120 min)
**Isolation**: New test files, doesn't affect production code

**Create Test Files**:

**1. Database Tests** (`tests/telegram-bot.database.test.js`):
```js
// Test database schema and constraints
const { createClient } = require('@supabase/supabase-js');

describe('Telegram Bot Database Tests', () => {
  let supabase;

  beforeAll(() => {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  });

  test('profiles table has new columns', async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('last_seen_ip, last_seen_at, bot_opt_in')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('bot_message_logs table exists and works', async () => {
    const testLog = {
      chat_id: 123456789,
      message_type: 'direct',
      content_preview: 'Test message',
      success: true
    };

    const { data, error } = await supabase
      .from('bot_message_logs')
      .insert([testLog])
      .select();

    expect(error).toBeNull();
    expect(data[0].id).toBeDefined();

    // Cleanup
    await supabase.from('bot_message_logs').delete().eq('id', data[0].id);
  });

  test('message type constraint works', async () => {
    const invalidLog = {
      chat_id: 123456789,
      message_type: 'invalid_type',
      success: true
    };

    const { error } = await supabase
      .from('bot_message_logs')
      .insert([invalidLog]);

    expect(error).toBeTruthy();
    expect(error.message).toContain('check constraint');
  });
});
```

**2. API Function Tests** (`tests/telegram-bot.api.test.js`):
```js
// Test Edge Functions
describe('Telegram Bot API Tests', () => {
  const FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('/rest/v1', '/functions/v1');
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  test('send-direct-message validates input', async () => {
    const response = await fetch(`${FUNCTIONS_URL}/send-direct-message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}) // Missing required fields
    });

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain('Missing fields');
  });

  test('send-weekly-summary returns success when enabled', async () => {
    // Set up environment for test
    process.env.ENABLE_WEEKLY_SUMMARY = 'true';
    process.env.TELEGRAM_WEEKLY_GROUP_CHAT_ID = '-1001234567890';

    const response = await fetch(`${FUNCTIONS_URL}/send-weekly-summary`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    });

    // Should not error (may fail if bot token not configured, but shouldn't crash)
    expect(response.status).toBeLessThan(500);
  });
});
```

**3. Integration Tests** (`tests/telegram-bot.integration.test.js`):
```js
// Full flow integration tests
describe('Telegram Bot Integration Tests', () => {
  test('IP extraction works with various headers', () => {
    function extractClientIP(headers) {
      const hdr = (n) => headers[n] || '';
      const candidates = [
        hdr('cf-connecting-ip'),
        hdr('x-forwarded-for').split(',')[0].trim(),
        hdr('x-real-ip'),
        hdr('x-client-ip')
      ];

      function isValidIP(ip) {
        if (!ip) return false;
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        return parts.every(part => {
          const num = parseInt(part, 10);
          return num >= 0 && num <= 255 && !isNaN(num);
        });
      }

      return candidates.find(ip => ip && isValidIP(ip)) || null;
    }

    expect(extractClientIP({
      'cf-connecting-ip': '203.0.113.1'
    })).toBe('203.0.113.1');

    expect(extractClientIP({
      'x-forwarded-for': '198.51.100.2, 203.0.113.1'
    })).toBe('198.51.100.2');

    expect(extractClientIP({
      'x-forwarded-for': 'invalid-ip, 203.0.113.1'
    })).toBe('203.0.113.1');

    expect(extractClientIP({})).toBe(null);
  });

  test('Rate limiting calculation', () => {
    const rateLimitDelay = 1000 / 20; // 20 messages per second
    expect(rateLimitDelay).toBe(50); // 50ms delay
  });
});
```

**Update Test Runner** (`tests/test-suite.js`):
```js
// Add to existing test suite
const { runTelegramBotTests } = require('./telegram-bot.test.js');

async function runTests() {
  // ... existing tests ...

  console.log('🤖 Running Telegram Bot Tests...');
  const telegramSuccess = await runTelegramBotTests();

  // ... rest of tests ...
}
```

### Task 7: External Cron Setup (30 min)
**Isolation**: External trigger, doesn't affect application

**GitHub Actions Cron** (`.github/workflows/weekly-summary.yml`):
```yaml
name: Weekly Summary

on:
  schedule:
    - cron: '0 9 * * 1' # Monday 9 AM UTC
  workflow_dispatch: # Manual trigger

jobs:
  send-summary:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Weekly Summary
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/send-weekly-summary" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -w "HTTP Status: %{http_code}\n"
```

**Testing**:
```bash
# Test manual trigger
gh workflow run weekly-summary.yml

# Check workflow status
gh run list --workflow=weekly-summary.yml
```

### Task 8: User Opt-out Interface (60 min)
**Isolation**: New settings component, doesn't affect existing UI

**Add Settings Component** (`components/telegram-bot-settings.tsx`):
```tsx
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSimpleAuth } from '@/hooks/use-simple-auth';

export function TelegramBotSettings() {
  const { user } = useSimpleAuth();
  const [botOptIn, setBotOptIn] = useState(user?.bot_opt_in ?? true);
  const [isUpdating, setIsUpdating] = useState(false);

  async function updateBotSettings(optIn: boolean) {
    if (!user) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bot_opt_in: optIn })
        .eq('id', user.id);

      if (error) throw error;
      setBotOptIn(optIn);
    } catch (error) {
      console.error('Failed to update bot settings:', error);
      // Revert UI change
      setBotOptIn(!optIn);
    } finally {
      setIsUpdating(false);
    }
  }

  if (!user?.telegram_id) {
    return null; // User not connected to Telegram
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Telegram Bot Settings</h3>
      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="bot-opt-in"
          checked={botOptIn}
          disabled={isUpdating}
          onChange={(e) => updateBotSettings(e.target.checked)}
          className="h-4 w-4 text-blue-600"
        />
        <label htmlFor="bot-opt-in" className="text-sm text-gray-700">
          Allow bot to send me messages
        </label>
      </div>
      <p className="text-xs text-gray-500">
        Disable this to stop receiving notifications via Telegram bot.
      </p>
    </div>
  );
}
```

**Testing**:
```tsx
// Add to existing settings page for testing
import { TelegramBotSettings } from '@/components/telegram-bot-settings';

// In settings page component:
<TelegramBotSettings />
```

## Risk Mitigation & Rollback Plan

### Rollback Strategy
Each task can be independently rolled back:

1. **Database**: Drop new columns/tables (data loss acceptable for new features)
2. **Functions**: Disable/delete Edge Functions
3. **Cron**: Disable GitHub Action
4. **UI**: Remove settings component

### Risk Assessment
- **Low Risk**: Database schema changes (isolated additions)
- **Medium Risk**: New Edge Functions (can be disabled quickly)
- **Low Risk**: External cron (just disables feature)

### Monitoring
```sql
-- Monitor bot message success rate
SELECT
  message_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE success = true) as successful,
  ROUND(COUNT(*) FILTER (WHERE success = true) * 100.0 / COUNT(*), 2) as success_rate
FROM bot_message_logs
WHERE sent_at > now() - interval '24 hours'
GROUP BY message_type;

-- Check recent failures
SELECT * FROM bot_message_logs
WHERE success = false
ORDER BY sent_at DESC
LIMIT 10;
```

## Timeline Summary
- **Day 1**: Tasks 1-3 (Database + IP Collection + API Library) = 2.25 hours
- **Day 2**: Tasks 4-5 (Functions) = 3 hours
- **Day 3**: Tasks 6-8 (Testing + Cron + UI) = 3.5 hours

**Total**: 8.75 hours across 3 days (comfortable pace with testing)

---

**Version**: 2.1 (Enhanced with detailed implementation plan)
**Last Updated**: 2025-08-09
**Focus**: Isolated, testable, low-risk implementation
