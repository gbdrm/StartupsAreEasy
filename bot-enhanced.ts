/// <reference types="https://deno.land/std@0.208.0/types.d.ts" />

// Enhanced Telegram Bot for Authentication
// Includes security tracking and better error handling per ChatGPT feedback

import { Bot, Context, BotError } from "https://deno.land/x/grammy@v1.18.1/mod.ts";
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const botToken = Deno.env.get("BOT_TOKEN");
const confirmUrl = Deno.env.get("CONFIRM_URL"); // Your Supabase Edge Function URL
const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://your-domain.com";
// Use Supabase's built-in environment variables
const supabaseAnonKey = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") || Deno.env.get("ANON_KEY");

// Enhanced environment logging for debugging
console.log("🤖 Bot starting with environment configuration:");
console.log(`📍 BOT_TOKEN: ${botToken ? `${botToken.substring(0, 20)}...` : 'MISSING'}`);
console.log(`📍 CONFIRM_URL: ${confirmUrl || 'MISSING'}`);
console.log(`📍 FRONTEND_URL: ${frontendUrl}`);
console.log(`📍 SUPABASE_ANON_KEY: ${supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING'}`);
console.log("🚀 Environment check complete");

if (!botToken || !confirmUrl || !supabaseAnonKey) {
    console.error("❌ CRITICAL: Missing required environment variables");
    console.error(`❌ BOT_TOKEN present: ${!!botToken}`);
    console.error(`❌ CONFIRM_URL present: ${!!confirmUrl}`);
    console.error(`❌ SUPABASE_ANON_KEY present: ${!!supabaseAnonKey}`);
    throw new Error("Missing required environment variables: BOT_TOKEN, CONFIRM_URL, SUPABASE_ANON_KEY");
}

const bot = new Bot(botToken);

// Rate limiting map for basic spam protection
const userAttempts = new Map();
const MAX_ATTEMPTS = 5;
const RATE_WINDOW = 60000; // 1 minute

bot.command("start", async (ctx: Context) => {
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

    // Enhanced logging with environment info
    console.log(`🔐 Login attempt from user ${user.id} (@${user.username}) with token ${token}`);
    console.log(`📍 Environment check - CONFIRM_URL: ${confirmUrl}`);
    console.log(`👤 User details: ID=${user.id}, username=${user.username}, first_name=${user.first_name}, last_name=${user.last_name}`);

    try {
        const requestBody = {
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
        };

        console.log(`📤 Sending request to ${confirmUrl}`);
        console.log(`📦 Request body:`, JSON.stringify(requestBody, null, 2));

        // Call the Supabase Edge Function with enhanced data
        const response = await fetch(confirmUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "StartupsAreEasy-Bot/1.0",
                "Authorization": `Bearer ${supabaseAnonKey}`,
                "apikey": supabaseAnonKey
            },
            body: JSON.stringify(requestBody),
        });

        console.log(`📥 Response status: ${response.status} ${response.statusText}`);
        console.log(`📥 Response headers:`, JSON.stringify([...response.headers.entries()]));

        let responseData;
        const responseText = await response.text();
        console.log(`📥 Raw response text: ${responseText}`);

        try {
            responseData = JSON.parse(responseText);
            console.log(`📥 Parsed response data:`, JSON.stringify(responseData, null, 2));
        } catch (parseError) {
            console.error(`❌ Failed to parse response as JSON:`, parseError);
            responseData = { error: "Invalid JSON response", raw: responseText };
        }

        if (response.ok) {
            console.log(`✅ Auth confirmed for user ${user.id} (@${user.username})`);

            await ctx.reply(
                "✅ Sign in confirmed!\n\n" +
                "You can now return to the website. The page should automatically update.\n\n" +
                "If the page doesn't update, try refreshing it."
                // Removed parse_mode to avoid MarkdownV2 escaping issues
            );

            // Optional: Send a follow-up message with a direct link
            setTimeout(async () => {
                await ctx.reply(
                    `🌐 Return to StartupsAreEasy: ${frontendUrl}`,
                    {
                        // Using plain text to avoid formatting issues
                        disable_web_page_preview: true
                    }
                );
            }, 1000);

        } else {
            console.error(`❌ Auth failed for user ${user.id}:`, response.status, responseData);
            console.error(`❌ Full error details: Status=${response.status}, StatusText=${response.statusText}`);
            console.error(`❌ Response data type: ${typeof responseData}, Content: ${JSON.stringify(responseData)}`);

            let errorMessage = "⚠️ Authentication failed. Please try again.";

            // Enhanced error message handling with more detailed logging
            if (response.status === 400) {
                console.log(`📝 Processing 400 error - checking error content...`);
                if (responseData.error?.includes("expired")) {
                    console.log(`📝 Token expired error detected`);
                    errorMessage = "⏰ This login link has expired. Please request a new one from the website.";
                } else if (responseData.error?.includes("used")) {
                    console.log(`📝 Token already used error detected`);
                    errorMessage = "🔄 This login link has already been used. Please request a new one.";
                } else if (responseData.error?.includes("Invalid token")) {
                    console.log(`📝 Invalid token error detected`);
                    errorMessage = "❌ Invalid login link. Please use the login button on the website.";
                } else {
                    console.log(`📝 Other 400 error: ${responseData.error}`);
                }
            } else if (response.status === 401) {
                console.log(`📝 401 Unauthorized error - likely Edge Function configuration issue`);
                errorMessage = "🔑 Authorization error. Please contact support.";
            } else if (response.status === 500) {
                console.log(`📝 500 Server error detected`);
                errorMessage = "🔧 Server error. Please try again or contact support.";
            } else {
                console.log(`📝 Unhandled error status: ${response.status}`);
            }

            await ctx.reply(errorMessage);
        }

    } catch (error) {
        console.error(`💥 Network/Fetch error for user ${user.id}:`, error);
        console.error(`💥 Error type: ${error?.constructor?.name}`);
        console.error(`💥 Error message: ${error?.message}`);
        console.error(`💥 Error stack: ${error?.stack}`);

        // Check if it's a network timeout or connection error
        const isNetworkError = error?.message?.includes('network') ||
            error?.message?.includes('timeout') ||
            error?.message?.includes('fetch') ||
            error?.message?.includes('connection');

        console.log(`💥 Classified as network error: ${isNetworkError}`);

        await ctx.reply(
            "🌐 Network error. Please check your connection and try again.\n\n" +
            "If the problem persists, try refreshing the website page."
            // Removed parse_mode to avoid formatting issues
        );
    }
});

// Help command
bot.command("help", async (ctx: Context) => {
    await ctx.reply(
        "🤖 StartupsAreEasy Authentication Bot\n\n" +
        "This bot helps you sign in to StartupsAreEasy.\n\n" +
        "📋 How to use:\n" +
        "1. Click 'Login with Telegram' on the website\n" +
        "2. You'll be redirected to this bot\n" +
        "3. Confirm your login here\n" +
        "4. Return to the website\n\n" +
        "❓ Need help? Visit our website or contact support."
        // Removed parse_mode to avoid formatting issues
    );
});

// Handle unknown commands
bot.on("message", async (ctx: Context) => {
    if (ctx.message.text && !ctx.message.text.startsWith("/")) {
        await ctx.reply(
            "🤔 I don't understand that message\\.\n\n" +
            "Use /help to learn how to sign in, or use the login button on the StartupsAreEasy website\\.",
            { parse_mode: "MarkdownV2" }
        );
    }
});

// Error handling
bot.catch((err: BotError<Context>) => {
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

// Wrap the bot initialization and webhook server logic in an async function
(async () => {
    // Initialize the bot
    await bot.init();

    // Start a custom webhook server
    serve(async (req: Request) => {
        const url = new URL(req.url);

        // Verify the secret token
        const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
        const expectedSecret = Deno.env.get("TG_SECRET_TOKEN");

        if (!expectedSecret || secretToken !== expectedSecret) {
            console.warn("🚨 Unauthorized request - secret token mismatch");
            return new Response("Unauthorized", { status: 401 });
        }

        // Pass the request to the bot
        try {
            await bot.handleUpdate(await req.json());
            return new Response("OK", { status: 200 });
        } catch (err) {
            console.error("Error handling update:", err);
            return new Response("Internal Server Error", { status: 500 });
        }
    });
})();

console.log("🤖 StartupsAreEasy authentication bot started with custom webhook server");