"use client"

import Link from "next/link"
import { useState } from "react"
import { AuthButton } from "@/components/auth-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { HelpCircle, Menu } from "lucide-react"
import type { User } from "@/lib/types"
import type { TelegramUser } from "@/lib/auth"

// Simple VisuallyHidden component for accessibility
const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <span className="absolute w-px h-px p-0 -m-px overflow-hidden clip-rect-0 whitespace-nowrap border-0">
    {children}
  </span>
)

interface HeaderProps {
  user: User | null
  onLogin: (telegramUser: TelegramUser) => void
  onLogout: () => void
}

export function Header({ user, onLogin, onLogout }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigationItems = [
    { href: "/", emoji: "🏠", label: "Home" },
    { href: "/startups", emoji: "🚀", label: "Startups" },
    { href: "/builders", emoji: "🧑‍💻", label: "Builders" },
  ]

  return (
    <TooltipProvider>
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
          
          {/* Desktop navigation - centered */}
          <div className="hidden md:flex flex-1 items-center justify-center gap-8">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-lg font-semibold hover:text-gray-700 transition-colors flex items-center gap-2"
              >
                <span>{item.emoji}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Desktop right side: About icon and Auth button */}
          <div className="hidden md:flex items-center gap-4 mr-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/about" className="text-gray-600 hover:text-gray-800 transition-colors">
                  <HelpCircle className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>About this project</p>
              </TooltipContent>
            </Tooltip>
            
            <AuthButton user={user} onLogin={onLogin} onLogout={onLogout} />
          </div>

          {/* Mobile: Hamburger menu in top right */}
          <div className="md:hidden flex-1 flex justify-end mr-4">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetHeader>
                  <SheetTitle>
                    <VisuallyHidden>Navigation Menu</VisuallyHidden>
                  </SheetTitle>
                </SheetHeader>
                
                <div className="flex flex-col space-y-4 mt-8">
                  {navigationItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-lg font-semibold hover:text-gray-700 transition-colors flex items-center gap-3 p-2 rounded-md hover:bg-gray-100"
                    >
                      <span className="text-xl">{item.emoji}</span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                  
                  {/* About link in mobile menu */}
                  <Link
                    href="/about"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-lg font-semibold hover:text-gray-700 transition-colors flex items-center gap-3 p-2 rounded-md hover:bg-gray-100"
                  >
                    <HelpCircle className="h-5 w-5" />
                    <span>About</span>
                  </Link>

                  {/* Auth section in mobile menu */}
                  <div className="pt-4 border-t border-gray-200">
                    <AuthButton user={user} onLogin={onLogin} onLogout={onLogout} />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </TooltipProvider>
  )
}
