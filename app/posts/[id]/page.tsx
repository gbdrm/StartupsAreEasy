import { notFound } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { PostClientWrapper } from "@/components/post-client-wrapper"
import { getPostByIdDirect } from "@/lib/api-direct"
import { getCommentsDirect } from "@/lib/api-direct"

interface PostPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function PostPage({ params }: PostPageProps) {
  // Await params for Next.js 15 compatibility
  const { id } = await params
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  
  try {
    // Get the post
    const post = await getPostByIdDirect(id)
    
    if (!post) {
      notFound()
    }

    // Get comments for this post
    const comments = await getCommentsDirect(id)

    return (
      <PostClientWrapper
        post={post}
        initialComments={comments}
      />
    )
  } catch (error) {
    console.error("Error loading post:", error)
    notFound()
  }
}

export async function generateMetadata({ params }: PostPageProps) {
  try {
    // Await params for Next.js 15 compatibility
    const { id } = await params
    const post = await getPostByIdDirect(id)
    
    if (!post) {
      return {
        title: "Post not found"
      }
    }

    const title = post.startup ? 
      `${post.startup.name} - ${post.type} post by ${post.user.name}` :
      `${post.type} post by ${post.user.name}`
    
    const description = post.content.length > 160 ? 
      `${post.content.substring(0, 160)}...` : 
      post.content

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        publishedTime: post.created_at,
        authors: [post.user.name],
      },
      twitter: {
        card: 'summary',
        title,
        description,
      }
    }
  } catch (error) {
    return {
      title: "Post not found"
    }
  }
}
