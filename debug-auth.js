#!/usr/bin/env node

// Simple test script to check the authentication flow
// Usage: node debug-auth.js

const https = require('https');

const API_BASE = 'http://localhost:3001';

async function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https');
        const lib = isHttps ? require('https') : require('http');

        const req = lib.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

async function testAuthFlow() {
    console.log('🧪 Testing Authentication Flow...\n');

    // Step 1: Create a test token
    const token = `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`1️⃣ Generated token: ${token}`);

    // Step 2: Pre-register token
    try {
        const createResult = await makeRequest(`${API_BASE}/api/create-login-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        console.log(`2️⃣ Token creation: ${createResult.status} - ${JSON.stringify(createResult.data)}`);

        if (createResult.status !== 200) {
            console.error('❌ Token creation failed');
            return;
        }

    } catch (error) {
        console.error('❌ Token creation error:', error.message);
        return;
    }

    // Step 3: Check token status (should be pending)
    try {
        const checkResult = await makeRequest(`${API_BASE}/api/check-login?token=${token}`);
        console.log(`3️⃣ Initial check: ${checkResult.status} - ${JSON.stringify(checkResult.data)}`);

        if (checkResult.data.status !== 'pending') {
            console.error('❌ Expected pending status');
            return;
        }

    } catch (error) {
        console.error('❌ Token check error:', error.message);
        return;
    }

    // Step 4: Simulate bot confirmation by calling Edge Function
    console.log('\n4️⃣ Now you need to manually test the Telegram bot:');
    console.log(`   Open: https://t.me/startups_are_easy_bot?start=${token}`);
    console.log(`   After confirming in bot, the token should have access_token`);

    // Step 5: Poll for completion
    console.log('\n5️⃣ Polling for completion (30 seconds)...');
    let attempts = 0;
    const maxAttempts = 15;

    const poll = async () => {
        attempts++;
        try {
            const result = await makeRequest(`${API_BASE}/api/check-login?token=${token}`);
            console.log(`   Poll ${attempts}: ${result.status} - ${JSON.stringify(result.data)}`);

            if (result.data.status === 'complete') {
                console.log('✅ Authentication completed!');
                console.log('🎉 Session data received:', result.data);
                return;
            }

            if (result.data.status === 'expired' || result.data.status === 'used') {
                console.log('❌ Token expired or used');
                return;
            }

            if (attempts < maxAttempts) {
                setTimeout(poll, 2000);
            } else {
                console.log('⏰ Polling timeout');
            }

        } catch (error) {
            console.error('❌ Poll error:', error.message);
        }
    };

    poll();
}

testAuthFlow().catch(console.error);
