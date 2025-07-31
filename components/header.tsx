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
      <div className="container flex h-16 items-center">
        {/* Logo on the left */}
        <div className="flex items-center ml-4">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <img
              src="/big_logo.png"
              alt="Startups Are Easy"
              className="h-10 w-auto"
            />
          </Link>
        </div>
        
        {/* Centered navigation links */}
        <div className="flex-1 flex items-center justify-center gap-6">
          <Link href="/startups" className="text-xl font-semibold hover:text-gray-700 transition-colors">
            Startups
          </Link>
          
          <Link href="/about" className="text-xl font-semibold hover:text-gray-700 transition-colors">
            About
          </Link>
        </div>
        
        {/* Auth button on the right */}
        <div className="mr-4">
          <AuthButton user={user} onLogin={onLogin} onLogout={onLogout} />
        </div>
      </div>
    </header>
  )
}
