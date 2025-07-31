"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { StartupForm } from "./startup-form"
import { Plus } from "lucide-react"
import type { User } from "@/lib/types"

interface StartupFormData {
  name: string
  description: string
  website_url: string
  industry: string
  stage: "idea" | "planning" | "building" | "mvp" | "beta" | "launched" | "scaling" | "acquired" | "paused"
  logo_url: string
}

interface CollapsibleStartupFormProps {
  user: User | null
  onSubmit: (data: StartupFormData) => Promise<void>
  isSubmitting: boolean
  onLoginRequired: () => void
}

export function CollapsibleStartupForm({ 
  user, 
  onSubmit, 
  isSubmitting, 
  onLoginRequired 
}: CollapsibleStartupFormProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSubmit = async (data: StartupFormData) => {
    await onSubmit(data)
    setIsExpanded(false)
  }

  const handleClick = () => {
    if (!user) {
      onLoginRequired()
      return
    }
    setIsExpanded(true)
  }

  if (isExpanded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create New Startup</h2>
          <button
            onClick={() => setIsExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
        <StartupForm
          user={user}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          onLoginRequired={onLoginRequired}
        />
      </div>
    )
  }

  return (
    <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={handleClick}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Plus className="h-5 w-5" />
          <span>Add your startup...</span>
        </div>
      </CardContent>
    </Card>
  )
}
