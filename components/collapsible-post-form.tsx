"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EnhancedPostForm } from "./enhanced-post-form"
import type { PostFormData, Startup, PostType } from "@/lib/types"

interface CollapsiblePostFormProps {
  user: any | null
  onSubmit: (data: PostFormData) => Promise<void>
  userStartups: Startup[]
  isSubmitting?: boolean
  onLoginRequired: () => void
  restrictToType?: PostType
}

export function CollapsiblePostForm({ 
  user, 
  onSubmit, 
  userStartups, 
  isSubmitting, 
  onLoginRequired,
  restrictToType
}: CollapsiblePostFormProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleTextBoxClick = () => {
    if (!user) {
      onLoginRequired()
      return
    }
    setIsExpanded(true)
  }

  const handleCancel = () => {
    setIsExpanded(false)
  }

  if (isExpanded && user) {
    return (
      <EnhancedPostForm
        onSubmit={async (data) => {
          await onSubmit(data)
          setIsExpanded(false)
        }}
        userStartups={userStartups}
        isSubmitting={isSubmitting}
        onCancel={handleCancel}
        restrictToType={restrictToType}
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
