"use client"

import type React from "react"

import { useState } from "react"
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
}

export function PostCard({ post, user, comments, onLike, onComment }: PostCardProps) {
  const [commentContent, setCommentContent] = useState("")
  const [isCommenting, setIsCommenting] = useState(false)
  const [showComments, setShowComments] = useState(false)

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentContent.trim() || !user) return

    setIsCommenting(true)
    await onComment(post.id, commentContent.trim())
    setCommentContent("")
    setIsCommenting(false)
  }

  const postType = POST_TYPES[post.type]

  return (
    <Card>
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
                <p className="text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {post.link && (
          <div className="mt-3">
            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              {new URL(post.link).hostname}
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
              onClick={() => user && onLike(post.id)}
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
              <span className="text-sm">{post.comments_count}</span>
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
