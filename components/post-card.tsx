"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Heart, MessageCircle, ExternalLink } from "lucide-react"
import { POST_TYPES, type Post, type Comment, type User } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { UserLink } from "./user-link"

interface PostCardProps {
  post: Post
  user: User | null
  comments: Comment[]
  onLike: (postId: string) => void
  onComment: (postId: string, content: string) => void
  clickable?: boolean // New prop to make post clickable
}

export function PostCard({ post, user, comments, onLike, onComment, clickable = true }: PostCardProps) {
  const [commentContent, setCommentContent] = useState("")
  const [isCommenting, setIsCommenting] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const router = useRouter()

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentContent.trim() || !user) return

    setIsCommenting(true)
    await onComment(post.id, commentContent.trim())
    setCommentContent("")
    setIsCommenting(false)
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.tagName === 'INPUT'
    ) {
      return
    }

    if (clickable) {
      router.push(`/posts/${post.id}`)
    }
  }

  const postType = POST_TYPES[post.type]

  return (
    <Card 
      className={clickable ? "cursor-pointer transition-all duration-200 hover:shadow-md" : ""}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <UserLink user={post.user} showAvatar avatarSize="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <UserLink user={post.user} showName />
                <UserLink user={post.user} showUsername />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm">{postType.emoji}</span>
                  <span className="text-xs font-medium text-muted-foreground">{postType.label}</span>
                </div>
                <span className="text-muted-foreground text-xs">·</span>
                <a 
                  href={`/posts/${post.id}`}
                  className="text-muted-foreground text-xs hover:text-foreground transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </a>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Show startup info for idea/launch/progress posts */}
        {post.startup && (post.type === "idea" || post.type === "launch" || post.type === "progress") && (
          <div className="mb-3 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">
                {post.type === "idea" && "💡"}
                {post.type === "launch" && "🚀"}
                {post.type === "progress" && "📈"}
              </span>
              <a
                href={`/startups/${post.startup.slug}`}
                className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1 group"
                onClick={(e) => {
                  e.stopPropagation()
                  if (post.startup?.slug) {
                    router.push(`/startups/${post.startup.slug}`)
                  }
                }}
              >
                {post.startup.name}
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              {post.startup.stage && (
                <span className="text-xs bg-background px-2 py-1 rounded">
                  {post.startup.stage}
                </span>
              )}
            </div>
            {post.startup.description && (
              <p className="text-sm text-muted-foreground">{post.startup.description}</p>
            )}
          </div>
        )}

        {/* For idea posts, only show additional content if it differs from the auto-generated content */}
        {post.type === "idea" && post.startup ? (
          // Only show content if it's different from the auto-generated format
          post.content !== `💡 **${post.startup.name}**\n\n${post.startup.description}` && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
          )
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
        )}

        {post.link && (
          <div className="mt-3">
            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full p-3 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{new URL(post.link).hostname}</span>
            </a>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 pb-2">
        <div className="w-full">
          {/* Like and Comment counts */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                console.log('💖 Like button clicked for post:', post.id, 'user exists:', !!user)
                if (user) {
                  console.log('💖 Calling onLike function...')
                  onLike(post.id)
                } else {
                  console.log('❌ No user, cannot like')
                }
              }}
              disabled={!user}
              className={`flex items-center gap-1 px-2 py-1 h-auto ${post.liked_by_user ? "text-red-500 hover:text-red-600" : ""}`}
            >
              <Heart className={`h-4 w-4 ${post.liked_by_user ? "fill-current" : ""}`} />
              <span className="text-sm">{post.likes_count}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-1 px-2 py-1 h-auto"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm">{comments.length}</span>
            </Button>
          </div>

          {/* Comments section - only show when toggled and there are comments or user can comment */}
          {showComments && (comments.length > 0 || user) && (
            <div className="mt-3 space-y-3">
              {/* Comments list */}
              {comments.length > 0 && (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <UserLink user={comment.user} showAvatar avatarSize="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <UserLink user={comment.user} showName />
                          <p className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <p className="text-sm mt-1">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Comment input - only show when user is signed in */}
              {user && (
                <form onSubmit={handleComment} className="mt-3">
                  <Input
                    placeholder="Add a comment..."
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    className="w-full"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleComment(e as any)
                      }
                    }}
                  />
                </form>
              )}
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
