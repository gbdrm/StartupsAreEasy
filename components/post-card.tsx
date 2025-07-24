"use client"

import type React from "react"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Heart, MessageCircle, ExternalLink, Send } from "lucide-react"
import { POST_TYPES, type Post, type Comment, type User } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import Image from "next/image"

interface PostCardProps {
  post: Post
  user: User | null
  comments: Comment[]
  onLike: (postId: string) => void
  onComment: (postId: string, content: string) => void
}

export function PostCard({ post, user, comments, onLike, onComment }: PostCardProps) {
  const [showComments, setShowComments] = useState(false)
  const [commentContent, setCommentContent] = useState("")
  const [isCommenting, setIsCommenting] = useState(false)

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
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.user.avatar || undefined} alt={post.user.name} />
            <AvatarFallback name={post.user.name} userId={post.user.id} />
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{post.user.name}</p>
              <p className="text-muted-foreground text-sm">@{post.user.username}</p>
              <span className="text-muted-foreground text-sm">·</span>
              <p className="text-muted-foreground text-sm">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg">{postType.emoji}</span>
              <span className="text-sm font-medium text-muted-foreground">{postType.label}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {post.image && (
          <div className="mt-3 rounded-lg overflow-hidden border">
            <Image
              src={post.image || "/placeholder.svg"}
              alt="Post image"
              width={600}
              height={300}
              className="w-full h-auto object-cover"
            />
          </div>
        )}

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

      <CardFooter className="pt-0">
        <div className="flex items-center gap-4 w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => user && onLike(post.id)}
            disabled={!user}
            className={`flex items-center gap-2 ${post.liked_by_user ? "text-red-500 hover:text-red-600" : ""}`}
          >
            <Heart className={`h-4 w-4 ${post.liked_by_user ? "fill-current" : ""}`} />
            <span>{post.likes_count}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{post.comments_count}</span>
          </Button>
        </div>

        {showComments && (
          <div className="w-full mt-4">
            <Separator className="mb-4" />

            {user && (
              <form onSubmit={handleComment} className="flex gap-2 mb-4">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar || undefined} alt={user.name} />
                  <AvatarFallback name={user.name} userId={user.id} />
                </Avatar>
                <div className="flex-1 flex gap-2">
                  <Input
                    placeholder="Add a comment..."
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="sm" disabled={!commentContent.trim() || isCommenting}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.user.avatar || undefined} alt={comment.user.name} />
                    <AvatarFallback name={comment.user.name} userId={comment.user.id} />
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{comment.user.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <p className="text-sm mt-1">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
