"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EnhancedPostForm } from "./enhanced-post-form"
import { useAuth } from "@/components/auth-context"
import type { PostFormData, Startup, PostType } from "@/lib/types"

interface CollapsiblePostFormProps {
  onSubmit: (data: PostFormData) => Promise<void>
  userStartups: Startup[]
  isSubmitting?: boolean
  onLoginRequired: () => void
  restrictToType?: PostType
  error?: string | null
  onErrorClear?: () => void
}

export function CollapsiblePostForm({ 
  onSubmit, 
  userStartups, 
  isSubmitting, 
  onLoginRequired,
  restrictToType,
  error,
  onErrorClear
}: CollapsiblePostFormProps) {
  const { user } = useAuth()
  const [isExpanded, setIsExpanded] = useState(false)

  const handleTextBoxClick = () => {
    if (!user) {
      onLoginRequired()
      return
    }
    setIsExpanded(true)
    // Clear any previous errors when opening the form
    if (onErrorClear) {
      onErrorClear()
    }
  }

  const handleCancel = () => {
    setIsExpanded(false)
    // Clear errors when canceling
    if (onErrorClear) {
      onErrorClear()
    }
  }

  const handleSubmit = async (data: PostFormData) => {
    try {
      await onSubmit(data)
      setIsExpanded(false) // Only close on success
    } catch (error) {
      // Don't close the form on error - let the parent handle error display
      console.error("Form submission error:", error)
    }
  }

  if (isExpanded && user) {
    return (
      <EnhancedPostForm
        onSubmit={handleSubmit}
        userStartups={userStartups}
        isSubmitting={isSubmitting}
        onCancel={handleCancel}
        restrictToType={restrictToType}
        error={error}
      />
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-4">
        <div
          className="w-full p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg cursor-text transition-colors duration-200 min-h-[48px] flex items-center"
          onClick={handleTextBoxClick}
        >
          <span className="text-gray-500 select-none text-base">
            What's on your mind?
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
