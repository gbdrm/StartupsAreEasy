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
import { LogOut, User as UserIcon } from "lucide-react"
import { useSimpleAuth } from "@/hooks/use-simple-auth"
import { AuthDialog } from "./auth-dialog"
import { useState, useEffect } from "react"
import Link from "next/link"
import { logger } from "@/lib/logger"

export function AuthButton() {
  const { user, logout } = useSimpleAuth()
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  // Auto-close dialog when user signs in successfully
  useEffect(() => {
    if (user && showLoginDialog) {
      logger.info("User authenticated - closing login dialog")
      setShowLoginDialog(false)
    }
  }, [user, showLoginDialog])

  // Debug logging - only shows in development
  logger.debug("AuthButton: user state", user)

  if (!user) {
    return (
      <>
        <Button onClick={() => setShowLoginDialog(true)}>
          Sign in
        </Button>
        <AuthDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
      </>
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
