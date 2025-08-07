"use client"

import { useState, useEffect, useCallback } from "react"
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
import { getUserProfileDirect, getPostsByUserDirect, getStartupsByUserDirect, getBulkCommentsDirect, createCommentDirect, toggleLikeDirect } from "@/lib/api-direct"
import { getCurrentUserToken } from "@/lib/auth"
import { useSimpleAuth } from "@/hooks/use-simple-auth"
import type { User, Post, Comment as PostComment, Startup } from "@/lib/types"

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const username = params.username as string
  const { user: currentUser } = useSimpleAuth()
  
  const [profileUser, setProfileUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [startups, setStartups] = useState<Startup[]>([])
  const [comments, setComments] = useState<PostComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch profile data by username
      const profile = await getUserProfileDirect(username)

      if (!profile) {
        setError("Profile not found")
        return
      }

      setProfileUser(profile)

      // Load posts by user with current user context for like status
      const userPosts = await getPostsByUserDirect(profile.id, currentUser?.id)
      setPosts(userPosts)

      // Load startups by user  
      const userStartups = await getStartupsByUserDirect(profile.id)
      setStartups(userStartups.filter(startup => startup.stage === "launched" || startup.stage === "scaling"))

      // Load comments for all posts using bulk API (same as homepage)
      if (userPosts.length > 0) {
        try {
          const postIds = userPosts.map(post => post.id)
          const allComments = await getBulkCommentsDirect(postIds)
          setComments(allComments)
        } catch (err) {
          console.error("Error loading comments for user posts:", err)
          setComments([])
        }
      } else {
        setComments([])
      }

    } catch (error: any) {
      console.error("Error loading profile:", error)
      setError("Failed to load profile")
    } finally {
      setLoading(false)
    }
  }, [username, currentUser?.id])

  // Load profile user and their posts
  useEffect(() => {
    if (username) {
      loadProfile()
    }
  }, [username, currentUser?.id, loadProfile]) // Reload when user changes to get correct like status

  const handleLike = async (postId: string) => {
    if (!currentUser) return

    try {
      // Get current user token for authentication
      const token = await getCurrentUserToken()
      if (!token) {
        console.error("No authentication token available")
        return
      }

      // Call the toggleLikeDirect function
      const result = await toggleLikeDirect(postId, currentUser.id, token)
      
      // Update the post in local state with new like status
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                liked_by_user: result.liked, 
                likes_count: result.likesCount 
              }
            : post
        )
      )
    } catch (error) {
      console.error("Error toggling like:", error)
    }
  }

  const handleAddComment = async (postId: string, content: string) => {
    if (!currentUser || !content.trim()) return false

    try {
      // Get current user token for authentication (required for RLS)
      const token = await getCurrentUserToken()
      if (!token) {
        console.error("No authentication token available")
        return false
      }

      const newComment = await createCommentDirect({
        post_id: postId,
        user_id: currentUser.id,
        content: content.trim()
      }, token)

      setComments(prev => [...prev, newComment])
      return true
    } catch (error) {
      console.error("Error adding comment:", error)
      return false
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-muted-foreground">Loading profile...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
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
        <Header />
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
      <Header />
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
                <AvatarFallback name={profileUser.name} userId={profileUser.id} className="text-lg" />
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
                  comments={comments.filter(c => c.post_id === post.id)}
                  onLike={handleLike}
                  onComment={handleAddComment}
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
