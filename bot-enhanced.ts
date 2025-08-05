// Enhanced Telegram Bot for Authentication
// Includes security tracking and better error handling per ChatGPT feedback

import { Bot } from "https://deno.land/x/grammy@v1.18.1/mod.ts";

const botToken = Deno.env.get("BOT_TOKEN");
const confirmUrl = Deno.env.get("CONFIRM_URL"); // Your Supabase Edge Function URL
const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://your-domain.com";

if (!botToken || !confirmUrl) {
    throw new Error("Missing required environment variables: BOT_TOKEN, CONFIRM_URL");
}

const bot = new Bot(botToken);

// Rate limiting map for basic spam protection
const userAttempts = new Map();
const MAX_ATTEMPTS = 5;
const RATE_WINDOW = 60000; // 1 minute

bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim();
    const user = ctx.from;

    if (!user) {
        return ctx.reply("❌ Unable to identify user.");
    }

    // Basic rate limiting (ChatGPT suggestion)
    const userId = user.id;
    const now = Date.now();
    const userHistory = userAttempts.get(userId) || { count: 0, resetTime: now + RATE_WINDOW };

    if (now > userHistory.resetTime) {
        userHistory.count = 0;
        userHistory.resetTime = now + RATE_WINDOW;
    }

    if (userHistory.count >= MAX_ATTEMPTS) {
        return ctx.reply("⏰ Too many login attempts. Please wait a minute and try again.");
    }

    userHistory.count++;
    userAttempts.set(userId, userHistory);

    // Validate login token
    if (!payload || !payload.startsWith("login_")) {
        await ctx.reply("❌ Invalid login link. Please use the login button on the website.");
        return;
    }

    const token = payload;

    // Enhanced logging
    console.log(`🔐 Login attempt from user ${user.id} (@${user.username}) with token ${token}`);

    try {
        // Call the Supabase Edge Function with enhanced data
        const response = await fetch(confirmUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "StartupsAreEasy-Bot/1.0"
            },
            body: JSON.stringify({
                token,
                chat_id: user.id,
                username: user.username || null,
                first_name: user.first_name || null,
                last_name: user.last_name || null,
                language_code: user.language_code || null,
                // Security info (ChatGPT suggestion)
                user_agent: "Telegram-Bot",
                origin: "telegram-bot",
                timestamp: new Date().toISOString()
            }),
        });

        const responseData = await response.json().catch(() => ({}));

        if (response.ok) {
            console.log(`✅ Auth confirmed for user ${user.id} (@${user.username})`);

            await ctx.reply(
                "✅ *Sign in confirmed!*\n\n" +
                "You can now return to the website\\. The page should automatically update\\.\n\n" +
                "_If the page doesn't update, try refreshing it\\._",
                { parse_mode: "MarkdownV2" }
            );

            // Optional: Send a follow-up message with a direct link
            setTimeout(async () => {
                await ctx.reply(
                    `🌐 [Return to StartupsAreEasy](${frontendUrl})`,
                    {
                        parse_mode: "Markdown",
                        disable_web_page_preview: true
                    }
                );
            }, 1000);

        } else {
            console.error(`❌ Auth failed for user ${user.id}:`, response.status, responseData);

            let errorMessage = "⚠️ Authentication failed\\. Please try again\\.";

            // Provide specific error messages when possible
            if (response.status === 400) {
                if (responseData.error?.includes("expired")) {
                    errorMessage = "⏰ This login link has expired\\. Please request a new one from the website\\.";
                } else if (responseData.error?.includes("used")) {
                    errorMessage = "🔄 This login link has already been used\\. Please request a new one\\.";
                } else if (responseData.error?.includes("Invalid token")) {
                    errorMessage = "❌ Invalid login link\\. Please use the login button on the website\\.";
                }
            }

            await ctx.reply(errorMessage, { parse_mode: "MarkdownV2" });
        }

    } catch (error) {
        console.error(`💥 Network error for user ${user.id}:`, error);

        await ctx.reply(
            "🌐 Network error\\. Please check your connection and try again\\.\n\n" +
            "_If the problem persists, try refreshing the website page\\._",
            { parse_mode: "MarkdownV2" }
        );
    }
});

// Help command
bot.command("help", async (ctx) => {
    await ctx.reply(
        "🤖 *StartupsAreEasy Authentication Bot*\n\n" +
        "This bot helps you sign in to StartupsAreEasy\\.\n\n" +
        "📋 *How to use:*\n" +
        "1\\. Click 'Login with Telegram' on the website\n" +
        "2\\. You'll be redirected to this bot\n" +
        "3\\. Confirm your login here\n" +
        "4\\. Return to the website\n\n" +
        "❓ Need help? Visit our website or contact support\\.",
        { parse_mode: "MarkdownV2" }
    );
});

// Handle unknown commands
bot.on("message", async (ctx) => {
    if (ctx.message.text && !ctx.message.text.startsWith("/")) {
        await ctx.reply(
            "🤔 I don't understand that message\\.\n\n" +
            "Use /help to learn how to sign in, or use the login button on the StartupsAreEasy website\\.",
            { parse_mode: "MarkdownV2" }
        );
    }
});

// Error handling
bot.catch((err) => {
    console.error("Bot error:", err);
});

// Cleanup old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [userId, data] of userAttempts.entries()) {
        if (now > data.resetTime) {
            userAttempts.delete(userId);
        }
    }
}, 60000); // Clean up every minute

console.log("🤖 StartupsAreEasy authentication bot started");
bot.start();
