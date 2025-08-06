"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

declare global {
  interface Window {
    TelegramLoginWidget?: {
      dataOnauth: (user: any) => void
    }
  }
}

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

interface TelegramLoginProps {
  botName: string
  onAuth: (user: TelegramUser) => void
}

export function TelegramLogin({ botName, onAuth }: TelegramLoginProps) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    console.debug("Initializing TelegramLogin component with botName:", botName)

    // Create the callback function
    window.TelegramLoginWidget = {
      dataOnauth: (user: TelegramUser) => {
        console.debug("Telegram user authenticated:", user)
        onAuth(user)
      },
    }

    // Create and append the Telegram login script
    const script = document.createElement("script")
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.setAttribute("data-telegram-login", botName)
    script.setAttribute("data-size", "large")
    script.setAttribute("data-onauth", "TelegramLoginWidget.dataOnauth(user)")
    script.setAttribute("data-request-access", "write")
    script.async = true

    // Hide loading when script loads
    script.onload = () => {
      console.debug("Telegram widget script loaded successfully.")
      setTimeout(() => setIsLoading(false), 500) // Small delay to ensure widget renders
    }

    script.onerror = (error) => {
      console.error("Failed to load Telegram widget script:", error)
      setIsLoading(false) // Hide loading even on error
    }

    const container = document.getElementById("telegram-login-container")
    if (container) {
      console.debug("Appending Telegram widget script to container.")
      container.appendChild(script)
    } else {
      console.error("Telegram login container not found.")
    }

    return () => {
      // Cleanup
      if (container && script.parentNode) {
        console.debug("Cleaning up Telegram widget script.")
        container.removeChild(script)
      }
      delete (window as any).TelegramLoginWidget
    }
  }, [botName, onAuth])

  return (
    <div className="relative">
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">Loading Telegram login...</p>
          </div>
        </div>
      )}
      <div 
        id="telegram-login-container" 
        className={isLoading ? "opacity-0" : "opacity-100 transition-opacity duration-300"}
      />
    </div>
  )
}
