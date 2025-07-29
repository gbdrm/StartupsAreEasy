"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { PostType, Startup } from "@/lib/types"

interface EnhancedPostFormProps {
  onSubmit: (data: PostFormData) => Promise<void>
  userStartups: Startup[]
  isSubmitting?: boolean
  onCancel: () => void
}

export interface PostFormData {
  type: PostType
  content?: string
  link?: string
  startup_name?: string
  startup_description?: string
  existing_startup_id?: string
}

export function EnhancedPostForm({ onSubmit, userStartups, isSubmitting, onCancel }: EnhancedPostFormProps) {
  const [postType, setPostType] = useState<PostType>("post")
  const [formData, setFormData] = useState<PostFormData>({
    type: "post"
  })

  const ideas = userStartups.filter(s => s.stage === "idea")
  const launched = userStartups.filter(s => s.stage === "launched" || s.stage === "scaling")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit({ ...formData, type: postType })
  }

  const renderFormFields = () => {
    switch (postType) {
      case "post":
        return (
          <>
            <Textarea
              placeholder="What's on your mind about startups?"
              value={formData.content || ""}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              className="min-h-[100px]"
              required
            />
            <Input
              type="url"
              placeholder="Add a link (optional)"
              value={formData.link || ""}
              onChange={e => setFormData({ ...formData, link: e.target.value })}
              className="w-full"
            />
          </>
        )

      case "idea":
        return (
          <>
            <Input
              placeholder="Startup idea name"
              value={formData.startup_name || ""}
              onChange={e => setFormData({ ...formData, startup_name: e.target.value })}
              required
            />
            <Textarea
              placeholder="Describe your startup idea"
              value={formData.startup_description || ""}
              onChange={e => setFormData({ ...formData, startup_description: e.target.value })}
              className="min-h-[100px]"
              required
            />
            <div className="text-sm text-muted-foreground">
              💡 This will create a new startup entry in the "idea" stage
            </div>
          </>
        )

      case "launch":
        return (
          <>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.existing_startup_id ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, existing_startup_id: "", startup_name: "", startup_description: "" })}
                  disabled={ideas.length === 0}
                >
                  Launch Existing Idea {ideas.length > 0 && `(${ideas.length})`}
                </Button>
                <Button
                  type="button"
                  variant={!formData.existing_startup_id ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, existing_startup_id: undefined })}
                >
                  Launch New Startup
                </Button>
              </div>

              {formData.existing_startup_id !== undefined && ideas.length > 0 && (
                <Select
                  value={formData.existing_startup_id}
                  onValueChange={value => setFormData({ ...formData, existing_startup_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an idea to launch" />
                  </SelectTrigger>
                  <SelectContent>
                    {ideas.map(idea => (
                      <SelectItem key={idea.id} value={idea.id}>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">💡</Badge>
                          <span>{idea.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {formData.existing_startup_id === undefined && (
                <>
                  <Input
                    placeholder="New startup name"
                    value={formData.startup_name || ""}
                    onChange={e => setFormData({ ...formData, startup_name: e.target.value })}
                    required
                  />
                  <Textarea
                    placeholder="Describe your startup"
                    value={formData.startup_description || ""}
                    onChange={e => setFormData({ ...formData, startup_description: e.target.value })}
                    className="min-h-[80px]"
                    required
                  />
                </>
              )}

              <Input
                type="url"
                placeholder="Launch announcement link (website, demo, etc.)"
                value={formData.link || ""}
                onChange={e => setFormData({ ...formData, link: e.target.value })}
                required
              />

              <Textarea
                placeholder="Tell everyone about your launch!"
                value={formData.content || ""}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
                className="min-h-[80px]"
                required
              />
            </div>
          </>
        )

      case "progress":
        return (
          <>
            {launched.length > 0 ? (
              <>
                <Select
                  value={formData.existing_startup_id}
                  onValueChange={value => setFormData({ ...formData, existing_startup_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your launched startup" />
                  </SelectTrigger>
                  <SelectContent>
                    {launched.map(startup => (
                      <SelectItem key={startup.id} value={startup.id}>
                        <div className="flex items-center gap-2">
                          <Badge variant="default">🚀</Badge>
                          <span>{startup.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Textarea
                  placeholder="Share your progress update"
                  value={formData.content || ""}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  className="min-h-[100px]"
                  required
                />

                <Input
                  type="url"
                  placeholder="Link to metrics, demo, or announcement (optional)"
                  value={formData.link || ""}
                  onChange={e => setFormData({ ...formData, link: e.target.value })}
                />
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-lg mb-2">🚀</div>
                <p>You need to launch a startup first before sharing progress updates!</p>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setPostType("launch")}
                  className="mt-2"
                >
                  Create a launch post instead
                </Button>
              </div>
            )}
          </>
        )
    }
  }

  const getPostTypeDescription = () => {
    switch (postType) {
      case "post":
        return "Share thoughts, insights, or discussions about startups"
      case "idea":
        return "Share a new startup idea and get feedback"
      case "launch":
        return "Announce your startup launch to the community"
      case "progress":
        return "Update the community on your startup's progress"
    }
  }

  const canSubmit = () => {
    switch (postType) {
      case "post":
        return !!formData.content?.trim()
      case "idea":
        return !!(formData.startup_name?.trim() && formData.startup_description?.trim())
      case "launch":
        if (formData.existing_startup_id !== undefined) {
          return !!(formData.existing_startup_id && formData.content?.trim() && formData.link?.trim())
        }
        return !!(formData.startup_name?.trim() && formData.startup_description?.trim() && formData.content?.trim() && formData.link?.trim())
      case "progress":
        return !!(formData.existing_startup_id && formData.content?.trim())
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create a </CardTitle>
        <div className="flex gap-2">
          {(["post", "idea", "launch", "progress"] as PostType[]).map(type => (
            <Button
              key={type}
              type="button"
              variant={postType === type ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setPostType(type)
                setFormData({ type })
              }}
            >
              {type === "post" && "💬"}
              {type === "idea" && "💡"}
              {type === "launch" && "🚀"}
              {type === "progress" && "📈"}
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{getPostTypeDescription()}</p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {renderFormFields()}

          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={!canSubmit() || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Creating..." : `Share ${postType.charAt(0).toUpperCase() + postType.slice(1)}`}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
