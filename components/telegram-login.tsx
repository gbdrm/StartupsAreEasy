"use client"

import { useEffect } from "react"

declare global {
  interface Window {
    TelegramLoginWidget: {
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
  useEffect(() => {
    // Create the callback function
    window.TelegramLoginWidget = {
      dataOnauth: (user: TelegramUser) => {
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

    const container = document.getElementById("telegram-login-container")
    if (container) {
      container.appendChild(script)
    }

    return () => {
      // Cleanup
      if (container && script.parentNode) {
        container.removeChild(script)
      }
    }
  }, [botName, onAuth])

  return <div id="telegram-login-container" />
}
