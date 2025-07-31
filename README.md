# 🧠 StartupsAreEasy

**A social platform for builders, makers, and dreamers who love starting things**

[![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-green)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)](https://tailwindcss.com/)

> *We celebrate the spark, not just the launch* ✨

## 🌟 What is StartupsAreEasy?

StartupsAreEasy is a home for people who love starting things — even when they're messy, weird, or half-baked. We believe that building doesn't have to be hard, lonely, or overplanned. Sometimes the best ideas begin with a quick note, a conversation, or a weekend experiment.

**This is that space.**

## 🚀 Features

### For Builders
- 💡 **Share ideas** — even if you don't know what to do with them yet
- 🚀 **Start projects** — and mark the moment you begin  
- ✅ **Track progress** — every step counts
- 🙋 **Ask questions** — and learn out loud
- 📢 **Share resources** — tools, links, lessons, anything that helps

### Platform Features
- 👤 **User profiles** with Telegram authentication
- 📝 **Rich post types** (ideas, projects, progress updates, questions, resources)
- 💬 **Interactive comments** and discussions
- ❤️ **Like and support** system
- 🔗 **Link sharing** with automatic preview
- 📱 **Responsive design** for all devices

## 🛠️ Tech Stack

- **Framework:** Next.js 15.2.4 with App Router
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Telegram Login Widget
- **Styling:** Tailwind CSS + shadcn/ui components
- **Icons:** Lucide React
- **Deployment:** Vercel-ready

## 🏃‍♂️ Quick Start

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/gbdrm/StartupsAreEasy.git
   cd StartupsAreEasy
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your Supabase credentials and development settings:
   ```env
   # Supabase configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   # Telegram Bot (for authentication)
   NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=your_telegram_bot_token  # Client-side (Login Widget)
   
   # Development testing (for local development)
   NEXT_PUBLIC_DEFAULT_USER_ID=your_default_user_id
   NEXT_PUBLIC_DEV_EMAIL=your-dev-email@example.com
   NEXT_PUBLIC_DEV_PASSWORD=your-secure-dev-password
   ```
   
   **For local development:**
   - Create a test user in your Supabase Auth dashboard
   - Use those credentials for `NEXT_PUBLIC_DEV_EMAIL` and `NEXT_PUBLIC_DEV_PASSWORD`
   - This enables proper authentication testing without hardcoded credentials

4. **Set up the database**
   
   Run the SQL scripts in the `scripts/` folder in your Supabase SQL editor:
   ```
   scripts/01-create-tables.sql
   scripts/05-add-startups-schema.sql
   scripts/06-create-comments-schema.sql
   scripts/06-posts-schema.sql
   ```

5. **Start the development server**
   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── about/             # About page
│   ├── profile/[userId]/  # Dynamic user profiles
│   ├── startups/          # Startups directory
│   └── page.tsx           # Home page
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   ├── auth-button.tsx   # Authentication button
│   ├── header.tsx        # Main navigation
│   ├── post-card.tsx     # Post display component
│   ├── post-form.tsx     # Post creation form
│   └── user-link.tsx     # User profile links
├── hooks/                # Custom React hooks
│   └── use-auth.ts       # Authentication hook
├── lib/                  # Utility functions and configs
│   ├── auth.ts           # Authentication logic
│   ├── posts.ts          # Post CRUD operations
│   ├── supabase.ts       # Supabase client
│   ├── types.ts          # TypeScript interfaces
│   └── utils.ts          # Utility functions
├── scripts/              # Database setup scripts
└── styles/               # Global styles
```

## 🎯 Core Philosophy

### Why we exist
- Because too many people wait until it's "ready"
- Because too many cool things never see the light
- Because starting should feel fun, social, and easy — not like a pitch deck

**StartupsAreEasy is here to make creativity visible, momentum natural, and failure a normal part of the ride.**

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### For Developers
- 🐛 **Report bugs** via GitHub Issues
- 💡 **Suggest features** and improvements
- 🔧 **Submit pull requests** for fixes and enhancements
- 📖 **Improve documentation**

### For the Community
- 💬 **Join our Telegram** for discussions and feedback
- 🧪 **Test new features** and provide feedback
- 📢 **Share the platform** with other builders

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 💬 Community & Support

- 💬 **Telegram Group:** [https://t.me/startupsareeasy](https://t.me/startupsareeasy)
- 🐛 **Issues:** [GitHub Issues](https://github.com/gbdrm/StartupsAreEasy/issues)
- 📧 **Contact:** Open an issue or reach out on Telegram

## 🙏 Acknowledgments

Built with amazing open-source tools:
- [Next.js](https://nextjs.org/) - The React framework for production
- [Supabase](https://supabase.com/) - Open source Firebase alternative
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Lucide](https://lucide.dev/) - Beautiful & consistent icon toolkit

---

**We're building this together — post by post, feature by feature, startup by startup.** 🚀

*Made with ❤️ for builders everywhere*
