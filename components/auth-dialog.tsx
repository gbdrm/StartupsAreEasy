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
import type { TelegramUser } from "@/lib/auth"

const isFakeLogin = typeof process !== 'undefined' && !!process.env.NEXT_PUBLIC_DEFAULT_USER_ID;

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogin: (telegramUser: TelegramUser) => void
}

export function AuthDialog({ open, onOpenChange, onLogin }: AuthDialogProps) {
  const handleTelegramAuth = (telegramUser: TelegramUser) => {
    onLogin(telegramUser)
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
