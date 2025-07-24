# Public social feed app

*Automatically synced with your [v0.dev](https://v0.dev) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/gbdrms-projects/v0-public-social-feed-app)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/7gpaho5owMo)

## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Deployment

Your project is live at:

**[https://vercel.com/gbdrms-projects/v0-public-social-feed-app](https://vercel.com/gbdrms-projects/v0-public-social-feed-app)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/7gpaho5owMo](https://v0.dev/chat/projects/7gpaho5owMo)**

## How It Works

1. Create and modify your project using [v0.dev](https://v0.dev)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Environment variables

Create a `.env.local` file in the project root with the following keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
```

The `SUPABASE_SERVICE_KEY` is used server-side by `lib/auth.ts` to perform
privileged operations while `NEXT_PUBLIC_SUPABASE_ANON_KEY` is used by the
browser client.
