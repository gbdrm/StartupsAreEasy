"use client"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LogOut, User as UserIcon } from "lucide-react"
import type { User } from "@/lib/types"
import { TelegramLogin } from "./telegram-login"
import { useState } from "react"
import Link from "next/link"
const isFakeLogin = typeof process !== 'undefined' && !!process.env.NEXT_PUBLIC_DEFAULT_USER_ID;

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

interface AuthButtonProps {
  user: User | null
  onLogin: (telegramUser: TelegramUser) => void
  onLogout: () => void
}

export function AuthButton({ user, onLogin, onLogout }: AuthButtonProps) {
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  const handleTelegramAuth = (telegramUser: TelegramUser) => {
    console.log("Telegram auth data received:", telegramUser)
    onLogin(telegramUser)
    setShowLoginDialog(false)
  }

  if (!user) {
    return (
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogTrigger asChild>
          <Button
            className={isFakeLogin ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "bg-[#0088cc] hover:bg-[#0077b3]"}
          >
            {isFakeLogin ? "Login Fake" : "Login with Telegram"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Login with Telegram</DialogTitle>
            <DialogDescription>Click the button below to authenticate with your Telegram account.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {isFakeLogin ? (
              <button
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-4 py-2 rounded"
                onClick={() => {
                  handleTelegramAuth({
                    id: 0,
                    first_name: "Fake",
                    last_name: "User",
                    username: "fakeuser",
                    photo_url: "",
                    auth_date: Date.now(),
                    hash: "fakehash"
                  });
                }}
              >
                Sign in as Fake User
              </button>
            ) : (
              <TelegramLogin
                botName="startups_are_easy_bot"
                onAuth={handleTelegramAuth}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatar || undefined} alt={user.name} />
            <AvatarFallback name={user.name} userId={user.id} />
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            <p className="font-medium">{user.name}</p>
            <p className="w-[200px] truncate text-sm text-muted-foreground">@{user.username}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/profile/${user.username}`}>
            <UserIcon className="mr-2 h-4 w-4" />
            <span>View Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
