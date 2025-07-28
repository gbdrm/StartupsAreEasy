"use client"

import Link from "next/link"
import { AuthButton } from "@/components/auth-button"
import type { User } from "@/lib/types"
import type { TelegramUser } from "@/lib/auth"

interface HeaderProps {
  user: User | null
  onLogin: (telegramUser: TelegramUser) => void
  onLogout: () => void
}

export function Header({ user, onLogin, onLogout }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4 ml-4">
          <Link href="/" className="text-xl font-bold hover:text-gray-700 transition-colors">
            Startups Are Easy
          </Link>
          <span className="text-2xl">🚀</span>
          <Link href="/startups" className="text-xl font-semibold hover:text-gray-700 transition-colors">
            Startups
          </Link>
        </div>
        <AuthButton user={user} onLogin={onLogin} onLogout={onLogout} />
      </div>
    </header>
  )
}
