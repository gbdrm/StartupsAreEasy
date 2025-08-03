"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TelegramLogin } from "./telegram-login"
import { useAuth } from "@/components/auth-context"
import type { TelegramUser } from "@/lib/auth"
import { HAS_FAKE_LOGIN } from "@/lib/constants"

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { login } = useAuth()

  // Debug logging to see which authentication path is used
  console.log('🔐 AuthDialog: Environment check', {
    HAS_FAKE_LOGIN,
    NODE_ENV: process.env.NODE_ENV,
    hasDevEmail: !!process.env.NEXT_PUBLIC_DEV_EMAIL,
    hasDevPassword: !!process.env.NEXT_PUBLIC_DEV_PASSWORD
  })

  const handleTelegramAuth = (telegramUser: TelegramUser) => {
    console.log('🔐 AuthDialog: handleTelegramAuth called with user:', telegramUser.username, telegramUser.first_name)
    login(telegramUser)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
