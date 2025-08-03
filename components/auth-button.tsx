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
import { useAuth } from "@/components/auth-context"
import { TelegramLogin } from "./telegram-login"
import { useState } from "react"
import Link from "next/link"
import { HAS_FAKE_LOGIN } from "@/lib/constants"

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export function AuthButton() {
  const { user, login, logout } = useAuth()
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  const handleTelegramAuth = (telegramUser: TelegramUser) => {
    login(telegramUser)
    setShowLoginDialog(false)
  }

  if (!user) {
    return (
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogTrigger asChild>
          <Button
            className={HAS_FAKE_LOGIN ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "bg-[#0088cc] hover:bg-[#0077b3]"}
          >
            {HAS_FAKE_LOGIN ? "Sign in" : "Sign in"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
            <DialogDescription>Sign in to your account to continue.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {HAS_FAKE_LOGIN ? (
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
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
