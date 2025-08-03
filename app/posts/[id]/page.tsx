import { notFound } from "next/navigation"
import { PostClientWrapper } from "@/components/post-client-wrapper"
import { getPostByIdDirect, getCommentsDirect } from "@/lib/api-direct"

interface PostPageProps {
  params: Promise<{
    id: string
  }>
  searchParams?: Promise<{ userId?: string }>
}

export default async function PostPage({ params, searchParams }: PostPageProps) {
  // Await params for Next.js 15 compatibility
  const { id } = await params
  const search = await searchParams || {}

  try {
    // Get the post with current user context for like status
    // Note: In SSR we don't have the current user, so client will need to refetch
    const post = await getPostByIdDirect(id, search.userId)
    
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
