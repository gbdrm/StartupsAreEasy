export type PostType = "post" | "idea" | "launch" | "progress"
export type StartupStage = "idea" | "planning" | "building" | "mvp" | "beta" | "launched" | "scaling" | "acquired" | "paused"

// Post form data for the enhanced form
export interface PostFormData {
  type: PostType
  content?: string
  link?: string
  startup_name?: string
  startup_description?: string
  existing_startup_id?: string
}

export interface User {
  id: string
  name: string
  username: string
  avatar: string
  telegram_id?: number
  first_name?: string
  last_name?: string
}

export interface Startup {
  id: string
  user_id?: string  // Made optional since existing table might not have this
  user?: User
  name: string
  slug: string
  description?: string
  website_url?: string
  logo_url?: string
  industry?: string
  stage?: StartupStage
  founded_date?: string
  location?: string
  team_size?: number
  funding_raised?: number
  target_market?: string
  estimated_timeline?: string
  looking_for?: string[]
  is_public?: boolean
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  user: User
  type: PostType
  content: string
  link?: string
  image?: string
  startup_id?: string
  startup?: Startup
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
  post: { emoji: "📝", label: "Post" },
  idea: { emoji: "💡", label: "Idea" },
  launch: { emoji: "🚀", label: "Launch" },
  progress: { emoji: "✅", label: "Progress" },
} as const

export const STARTUP_STAGES = {
  idea: { emoji: "💡", label: "Idea", color: "text-yellow-600" },
  planning: { emoji: "📋", label: "Planning", color: "text-blue-600" },
  building: { emoji: "🔨", label: "Building", color: "text-orange-600" },
  mvp: { emoji: "🚧", label: "MVP", color: "text-purple-600" },
  beta: { emoji: "🧪", label: "Beta", color: "text-indigo-600" },
  launched: { emoji: "🚀", label: "Launched", color: "text-green-600" },
  scaling: { emoji: "📈", label: "Scaling", color: "text-emerald-600" },
  acquired: { emoji: "🏆", label: "Acquired", color: "text-amber-600" },
  paused: { emoji: "⏸️", label: "Paused", color: "text-gray-600" },
} as const
