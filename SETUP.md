# Development Setup Guide

## Environment Variables Setup

1. **Copy the environment template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Set up Supabase:**
   - Go to [Supabase](https://supabase.com) and create a new project
   - Get your project URL and anon key from Settings > API
   - Add them to `.env.local`

3. **Set up Telegram Bot (optional for testing):**
   - Create a bot with [@BotFather](https://t.me/botfather) on Telegram
   - Get the bot token and add it to `.env.local` as `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN`
   - Configure your edge function with the appropriate server-side environment variable

4. **Create development test user:**
   - Go to your Supabase project > Authentication > Users
   - Click "Add user" and create a test user with email/password
   - Use these credentials in `.env.local` for `NEXT_PUBLIC_DEV_EMAIL` and `NEXT_PUBLIC_DEV_PASSWORD`

5. **Get default user ID (for local testing):**
   - After creating the test user, copy their User UID
   - Add it as `NEXT_PUBLIC_DEFAULT_USER_ID` in `.env.local`

## Database Setup

Run the SQL scripts in order in your Supabase SQL editor:

1. `scripts/01-create-tables.sql` - Basic tables
2. `scripts/05-add-startups-schema.sql` - Startups functionality
3. `scripts/06-create-comments-schema.sql` - Comments system
4. `scripts/06-posts-schema.sql` - Posts enhancements
5. `scripts/18-restore-proper-rls-policies.sql` - Security policies

## Security Notes

- Never commit `.env.local` to git (it's already in `.gitignore`)
- The development credentials are only for local testing
- In production, use proper Telegram authentication
- All sensitive data should be in environment variables, never hardcoded
