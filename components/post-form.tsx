"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LinkIcon, Send } from "lucide-react"
import type { User } from "@/lib/types"
import type { PostType } from "@/lib/types"
import { POST_TYPES } from "@/lib/types"

interface PostFormProps {
  user: User | null
  onSubmit: (data: {
    type: PostType
    content: string
    link?: string
  }) => void
}

export function PostForm({ user, onSubmit }: PostFormProps) {
  const [type, setType] = useState<PostType>("post")
  const [content, setContent] = useState("")
  const [link, setLink] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !user) return

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit({
        type,
        content: content.trim(),
        link: link.trim() || undefined,
      })

      // Reset form
      setContent("")
      setLink("")
      setIsExpanded(false)
    } catch (err) {
      setError("Failed to submit. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isExpanded])

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <p>Login to create posts</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!isExpanded) {
    return (
      <Card>
        <CardContent className="py-4 cursor-pointer" onClick={() => setIsExpanded(true)}>
          <div className="text-muted-foreground">What's on your mind?</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Share with the community
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(POST_TYPES).map(([value, { emoji, label }]) => (
                <Button
                  key={value}
                  type="button"
                  variant={type === value ? "default" : "outline"}
                  onClick={() => setType(value as PostType)}
                  className="flex items-center gap-2"
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              placeholder="Share your thoughts..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px] resize-none"
              required
              ref={textareaRef}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="link" className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Link (optional)
              </Label>
              <Input
                id="link"
                type="url"
                placeholder="https://..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={!content.trim() || isSubmitting}>
            {isSubmitting ? "Posting..." : "Post"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
