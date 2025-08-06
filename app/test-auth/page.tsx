"use client";

import { useState } from 'react';
import { useBotAuth } from '@/hooks/use-bot-auth';

export default function TestAuthPage() {
    const { authState, loginWithTelegramBot, cancelLogin } = useBotAuth();
    const [debugInfo, setDebugInfo] = useState<any>(null);

    const handleTestLogin = async () => {
        try {
            setDebugInfo({ status: 'Starting authentication...' });
            await loginWithTelegramBot();
            setDebugInfo({ status: 'Authentication completed!' });
        } catch (error) {
            setDebugInfo({ 
                status: 'Authentication failed', 
                error: error instanceof Error ? error.message : String(error) 
            });
        }
    };

    const testTokenCheck = async () => {
        const token = `login_test_${Date.now()}`;
        try {
            const response = await fetch(`/api/check-login?token=${token}`);
            const data = await response.json();
            setDebugInfo({ tokenCheck: data, token });
        } catch (error) {
            setDebugInfo({ 
                tokenCheckError: error instanceof Error ? error.message : String(error) 
            });
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Authentication Debug Page</h1>
            
            <div className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold mb-2">Auth State:</h2>
                    <pre className="bg-gray-100 p-4 rounded">
                        {JSON.stringify(authState, null, 2)}
                    </pre>
                </div>

                <div>
                    <button 
                        onClick={handleTestLogin}
                        disabled={authState.isLoading}
                        className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
                    >
                        {authState.isLoading ? 'Authenticating...' : 'Test Telegram Login'}
                    </button>
                    
                    <button 
                        onClick={cancelLogin}
                        className="bg-red-500 text-white px-4 py-2 rounded mr-2"
                    >
                        Cancel Login
                    </button>

                    <button 
                        onClick={testTokenCheck}
                        className="bg-green-500 text-white px-4 py-2 rounded"
                    >
                        Test Token Check API
                    </button>
                </div>

                {debugInfo && (
                    <div>
                        <h2 className="text-lg font-semibold mb-2">Debug Info:</h2>
                        <pre className="bg-gray-100 p-4 rounded">
                            {JSON.stringify(debugInfo, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
