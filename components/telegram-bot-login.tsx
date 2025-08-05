// Telegram Bot Login Component
// Provides UI for the new bot-based authentication with visual indicators

"use client";

import { useState, useEffect } from 'react';
import { useBotAuth } from '@/hooks/use-bot-auth';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircle, Clock, AlertCircle, X } from 'lucide-react';
import { logger } from '@/lib/logger';

export function TelegramBotLogin() {
  const { authState, loginWithTelegramBot, cancelLogin } = useBotAuth();
  const [timeElapsed, setTimeElapsed] = useState(0);
  
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

  const handleLogin = async () => {
    try {
      await loginWithTelegramBot();
    } catch (error) {
      logger.error('Login button error', error);
    }
  };

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show different states based on auth progress
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
        
        <div className="text-center space-y-1">
          <p className="text-xs text-green-700">
            Please confirm the login in your Telegram app
          </p>
          <p className="text-xs text-green-600">
            This will timeout in {formatTime(300 - timeElapsed)} minutes
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
        <p>Click to open Telegram and confirm your login</p>
        <p className="mt-1">Make sure you have Telegram installed</p>
      </div>
    </div>
  );
}

export default TelegramBotLogin;
