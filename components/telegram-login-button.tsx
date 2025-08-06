import React, { useState } from 'react';
import { logger } from '@/lib/logger';

const TelegramLoginButton: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Step 1: Initiate Telegram authentication
      const response = await fetch('/api/telegram-initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to initiate Telegram authentication');
      }

      const { authUrl } = await response.json();

      // Step 2: Redirect user to Telegram bot
      window.location.href = authUrl;
    } catch (err) {
      logger.error('Telegram login error', err);
      setError('Failed to start Telegram login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {success ? (
        <p>✅ Login successful!</p>
      ) : (
        <button
          onClick={handleLogin}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login with Telegram'}
        </button>
      )}

      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
};

export default TelegramLoginButton;
