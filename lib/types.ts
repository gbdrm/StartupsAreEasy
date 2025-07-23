export type PostType = "idea" | "started" | "progress" | "fail" | "link"

export interface User {
  id: string
  name: string
  username: string
  avatar: string
  telegram_id?: number
  first_name?: string
  last_name?: string
}

export interface Post {
  id: string
  user: User
  type: PostType
  content: string
  link?: string
  image?: string
  created_at: string
  likes_count: number
  comments_count: number
  liked_by_user?: boolean
}

export interface Comment {
  id: string
  post_id: string
  user: User
  content: string
  created_at: string
}

export const POST_TYPES = {
  idea: { emoji: "💡", label: "Idea" },
  started: { emoji: "🚀", label: "Started" },
  progress: { emoji: "✅", label: "Progress" },
  fail: { emoji: "❌", label: "Fail" },
  link: { emoji: "🔗", label: "Link" },
} as const
