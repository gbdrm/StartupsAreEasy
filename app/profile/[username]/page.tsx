"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { PostCard } from "@/components/post-card"
import { StartupCard } from "@/components/startup-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, ArrowLeft, Calendar, MapPin, Link as LinkIcon } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getPosts, toggleLike, getComments, createComment } from "@/lib/posts"
import { getUserStartups } from "@/lib/startups"
import { signInWithTelegram, signOut, getCurrentUserProfile } from "@/lib/auth"
import type { User, Post, Comment, Startup } from "@/lib/types"
import type { TelegramUser } from "@/lib/auth"

interface ProfileData extends User {
  bio?: string
  location?: string
  website?: string
  joined_at?: string
  posts_count?: number
  followers_count?: number
  following_count?: number
}

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const username = params.username as string
  
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [profileUser, setProfileUser] = useState<ProfileData | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [startups, setStartups] = useState<Startup[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load current user
  useEffect(() => {
    async function fetchCurrentUser() {
      const user = await getCurrentUserProfile()
      setCurrentUser(user)
    }
    fetchCurrentUser()
  }, [])

  // Load profile user and their posts
  useEffect(() => {
    if (username) {
      loadProfile()
    }
  }, [username]) // Remove currentUser dependency to prevent unnecessary re-fetches

  const loadProfile = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch profile data by username
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, first_name, last_name, avatar_url, bio, location, website, created_at")
        .eq("username", username)
        .single()

      if (profileError || !profile) {
        setError("Profile not found")
        return
      }

      // Format profile data
      const profileData: ProfileData = {
        id: profile.id,
        name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
        username: profile.username ?? "",
        avatar: profile.avatar_url ?? "",
        first_name: profile.first_name,
        last_name: profile.last_name,
        bio: profile.bio,
        location: profile.location,
        website: profile.website,
        joined_at: profile.created_at,
      }

      setProfileUser(profileData)

      // Fetch user's posts and startups in parallel
      const [userPostsResult, userStartupsResult] = await Promise.all([
        // Get all posts (including ideas)  
        supabase.rpc("get_user_posts_with_details", {
          profile_user_id: profile.id,
          current_user_id: currentUser?.id || null,
        }),
        // Get user's launched startups
        getUserStartups(profile.id).then(allStartups =>
          allStartups.filter(startup => startup.stage === "launched" || startup.stage === "scaling")
        )
      ])

      if (userPostsResult.error) {
        console.error("Error fetching user posts:", userPostsResult.error)
        setPosts([])
        setStartups([])
        setComments([])
        return
      }

      // Format all posts (including ideas)
      const allUserPosts = userPostsResult.data.map((post: any) => ({
        id: post.id,
        user: {
          id: post.user_id,
          name: `${post.first_name} ${post.last_name || ""}`.trim(),
          username: post.username,
          avatar: post.avatar_url,
        },
        type: post.type,
        content: post.content,
        link: post.link_url,
        image: post.image_url,
        created_at: post.created_at,
        likes_count: post.likes_count,
        comments_count: post.comments_count,
        liked_by_user: currentUser ? post.liked_by_user : false,
      })) as Post[]

      setPosts(allUserPosts)
      setStartups(userStartupsResult)

      // Batch load comments for all posts in a single query
      const allContentIds = allUserPosts.map(item => item.id)
      if (allContentIds.length > 0) {
        
        // Use a simpler join approach - since comments.user_id = profiles.id (both reference auth.users.id)
        const { data: allComments, error: commentsError } = await supabase
          .from("comments")
          .select(`
            id,
            content,
            created_at,
            user_id,
            post_id,
            profiles!user_id (
              id,
              username,
              first_name,
              last_name,
              avatar_url
            )
          `)
          .in("post_id", allContentIds)
          .order("created_at", { ascending: true })

        if (!commentsError && allComments) {
          const formattedComments = allComments.map((comment: any) => ({
            id: comment.id,
            content: comment.content,
            created_at: comment.created_at,
            user_id: comment.user_id,
            post_id: comment.post_id,
            user: {
              id: comment.profiles?.id || comment.user_id,
              name: comment.profiles ? `${comment.profiles.first_name} ${comment.profiles.last_name || ""}`.trim() : "Unknown User",
              username: comment.profiles?.username || "unknown",
              avatar: comment.profiles?.avatar_url,
            }
          }))
          setComments(formattedComments)
        } else {
          setComments([])
        }
      } else {
        setComments([])
      }

    } catch (err) {
      console.error("Error loading profile:", err)
      setError("Failed to load profile. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (telegramUser: TelegramUser) => {
    try {
      setError(null)
      const user = await signInWithTelegram(telegramUser)
      setCurrentUser(user)
    } catch (err) {
      setError(`Failed to log in: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      setCurrentUser(null)
    } catch (err) {
      console.error("Logout error:", err)
    }
  }

  const handleLike = async (postId: string) => {
    if (!currentUser) return
    
    try {
      const isLiked = await toggleLike(postId, currentUser.id)
      
      // Update posts
      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              liked_by_user: isLiked,
              likes_count: isLiked ? post.likes_count + 1 : post.likes_count - 1,
            }
          }
          return post
        })
      )
    } catch (error) {
      console.error("Error toggling like:", error)
    }
  }

  const handleComment = async (postId: string, content: string) => {
    if (!currentUser) return

    try {
      const newComment = await createComment({
        postId,
        userId: currentUser.id,
        content,
      })

      // Add the new comment to local state instead of reloading
      const formattedNewComment = {
        id: newComment.id,
        content: newComment.content,
        created_at: newComment.created_at,
        user_id: newComment.user_id,
        post_id: newComment.post_id,
        user: {
          id: currentUser.id,
          name: currentUser.name,
          username: currentUser.username,
          avatar: currentUser.avatar,
        }
      }

      setComments(prevComments => [...prevComments, formattedNewComment])

      // Update comment count for posts
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId
            ? { ...post, comments_count: post.comments_count + 1 }
            : post
        )
      )
    } catch (error) {
      console.error("Error creating comment:", error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />
        <main className="container max-w-4xl mx-auto py-8 px-4">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </main>
      </div>
    )
  }

  if (error || !profileUser) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />
        <main className="container max-w-4xl mx-auto py-8 px-4">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Alert variant="destructive">
            <AlertDescription>{error || "Profile not found"}</AlertDescription>
          </Alert>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />
      <main className="container max-w-4xl mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Profile Header */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profileUser.avatar || undefined} alt={profileUser.name} />
                <AvatarFallback className="text-lg">
                  {profileUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{profileUser.name}</h1>
                <p className="text-muted-foreground">@{profileUser.username}</p>
                
                {profileUser.bio && (
                  <p className="mt-3 text-base">{profileUser.bio}</p>
                )}

                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  {profileUser.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {profileUser.location}
                    </div>
                  )}
                  {profileUser.website && (
                    <div className="flex items-center gap-1">
                      <LinkIcon className="h-4 w-4" />
                      <a href={profileUser.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {profileUser.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {profileUser.joined_at && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Joined {new Date(profileUser.joined_at).toLocaleDateString('en-US', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Content Tabs */}
        <Tabs defaultValue="posts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
            <TabsTrigger value="startups">🚀 Launched ({startups.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="posts" className="space-y-6">
            {posts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No posts yet</p>
                </CardContent>
              </Card>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={currentUser}
                  comments={comments.filter(c => c.post_id === post.id)}
                  onLike={handleLike}
                  onComment={handleComment}
                />
              ))
            )}
          </TabsContent>
          
          <TabsContent value="startups" className="space-y-6">
            {startups.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No launched startups yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {startups.map((startup) => (
                  <StartupCard
                    key={startup.id}
                    startup={startup}
                    onClick={() => {
                      try {
                        router.push(`/startups/${startup.slug}`)
                      } catch (error) {
                        console.error('Navigation error:', error)
                        window.location.href = `/startups/${startup.slug}`
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
