// Telegram Bot Login Component
// Provides UI for the new bot-based authentication with visual indicators

"use client";

import { useState, useEffect } from 'react';
import { useBotAuth } from '@/hooks/use-bot-auth';
import { useSimpleAuth } from '@/hooks/use-simple-auth';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircle, Clock, AlertCircle, X, CheckCircle, Copy } from 'lucide-react';
import { logger } from '@/lib/logger';

export function TelegramBotLogin() {
  const { authState, loginWithTelegramBot, cancelLogin } = useBotAuth();
  const { user } = useSimpleAuth(); // Check global auth state
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Show success state briefly when user signs in
  useEffect(() => {
    if (user && (authState.isLoading || authState.isPolling)) {
      logger.info("Authentication completed successfully");
      setShowSuccess(true);
      // Reset success state after a brief moment
      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
    }
  }, [user, authState.isLoading, authState.isPolling]);
  
  // Timer for showing elapsed time during polling (ChatGPT suggestion for visual indicators)
  useEffect(() => {
    if (!authState.isPolling) {
      setTimeElapsed(0);
      return;
    }
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [authState.isPolling]);

  // Check for pending login on component mount (recovery feature)
  useEffect(() => {
    const pendingToken = localStorage.getItem('pending_login_token');
    const loginStartedAt = localStorage.getItem('login_started_at');
    
    if (pendingToken && loginStartedAt) {
      const timeSinceStart = Date.now() - parseInt(loginStartedAt);
      const maxAge = 10 * 60 * 1000; // 10 minutes
      
      if (timeSinceStart < maxAge) {
        logger.info('Resuming pending bot authentication', { pendingToken });
        // Could automatically resume polling here if desired
      } else {
        logger.info('Cleaning up expired pending authentication');
        localStorage.removeItem('pending_login_token');
        localStorage.removeItem('login_started_at');
      }
    }
  }, []);

  const [telegramUrl, setTelegramUrl] = useState<string>('');
  const [loginToken, setLoginToken] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const handleLogin = async () => {
    try {
      await loginWithTelegramBot();
    } catch (error) {
      logger.error('Login button error', error);
    }
  };

  // Store the telegram URL and token for fallback UI
  useEffect(() => {
    const storedToken = localStorage.getItem('pending_login_token');
    if (storedToken) {
      setLoginToken(storedToken);
      const botUsername = 'startups_are_easy_bot';
      const encodedToken = encodeURIComponent(storedToken);
      setTelegramUrl(`https://t.me/${botUsername}?start=${encodedToken}`);
    }
  }, [authState.isPolling]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Copy command to clipboard
  const copyCommand = async () => {
    if (loginToken) {
      try {
        await navigator.clipboard.writeText(`/start ${loginToken}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        logger.error('Failed to copy command:', err);
      }
    }
  };

  // Show different states based on auth progress
  
  // Success state - briefly shown when authentication completes
  if (showSuccess || user) {
    return (
      <div className="flex flex-col items-center space-y-4 p-6 border rounded-lg bg-green-50">
        <CheckCircle className="h-8 w-8 text-green-600" />
        <div className="text-center">
          <p className="text-sm font-medium text-green-800">Authentication Successful!</p>
          <p className="text-xs text-green-600 mt-1">Welcome back</p>
        </div>
      </div>
    );
  }

  if (authState.isLoading && !authState.isPolling) {
    return (
      <div className="flex flex-col items-center space-y-4 p-6 border rounded-lg bg-blue-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm text-blue-800">Opening Telegram...</p>
        <p className="text-xs text-blue-600">Please check your Telegram app</p>
      </div>
    );
  }

  if (authState.isPolling) {
    return (
      <div className="flex flex-col items-center space-y-4 p-6 border rounded-lg bg-green-50">
        <div className="flex items-center space-x-2">
          <MessageCircle className="h-6 w-6 text-green-600" />
          <Loader2 className="h-4 w-4 animate-spin text-green-600" />
        </div>
        
        <div className="text-center">
          <p className="text-sm font-medium text-green-800">
            Waiting for Telegram confirmation...
          </p>
          <div className="flex items-center justify-center space-x-2 mt-2">
            <Clock className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-600">
              {formatTime(timeElapsed)} elapsed
            </span>
          </div>
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-xs text-green-700 font-medium">
            📱 Complete login in Telegram:
          </p>
          
          <div className="bg-green-100 p-3 rounded-lg space-y-2">
            <p className="text-xs text-green-800 font-medium">
              Method 1: Click this link
            </p>
            {telegramUrl && (
              <a 
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-blue-500 text-white px-3 py-2 rounded text-xs hover:bg-blue-600 transition-colors"
              >
                🚀 Open Telegram Bot
              </a>
            )}
            <p className="text-xs text-green-600">
              Then tap the blue "START" button
            </p>
          </div>

          <div className="bg-green-50 p-3 rounded text-xs text-green-700">
            <p className="font-medium mb-2">Method 2: Manual steps</p>
            <div className="space-y-1">
              <p>1. Open Telegram app</p>
              <p>2. Search: <code className="bg-gray-200 px-1 rounded">@startups_are_easy_bot</code></p>
              <div className="flex items-center gap-2">
                <span>3. Send this command:</span>
                <Button
                  onClick={copyCommand}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 bg-gray-200 hover:bg-gray-300"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {copied ? '✓ Copied' : 'Copy'}
                </Button>
              </div>
              <code className="block bg-gray-200 p-1 rounded text-xs break-all">
                /start {loginToken}
              </code>
            </div>
          </div>
          
          <p className="text-xs text-green-500 mt-2">
            ⏱️ Timeout in {formatTime(300 - timeElapsed)}
          </p>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={cancelLogin}
          className="mt-2"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    );
  }

  if (authState.error) {
    return (
      <div className="flex flex-col items-center space-y-4 p-6 border rounded-lg bg-red-50">
        <AlertCircle className="h-6 w-6 text-red-600" />
        <div className="text-center">
          <p className="text-sm font-medium text-red-800">Authentication Error</p>
          <p className="text-xs text-red-600 mt-1">{authState.error}</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => window.location.reload()}
          className="mt-2"
        >
          Try Again
        </Button>
      </div>
    );
  }

  // Default login button
  return (
    <div className="flex flex-col items-center space-y-4">
      <Button 
        onClick={handleLogin}
        disabled={authState.isLoading}
        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
        size="lg"
      >
        <MessageCircle className="h-5 w-5" />
        <span>Login with Telegram Bot</span>
      </Button>
      
      <div className="text-center text-xs text-gray-600 max-w-xs">
        <p className="font-medium">📱 Click to open Telegram</p>
        <p className="mt-1">Then tap the blue "START" button in the chat</p>
        <p className="mt-1 text-gray-500">Make sure you have Telegram installed</p>
      </div>
    </div>
  );
}

export default TelegramBotLogin;
