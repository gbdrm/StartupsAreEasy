import { notFound } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { StartupClientWrapper } from "@/components/startup-client-wrapper"
import { getStartupBySlug } from "@/lib/startups"
import { getPosts } from "@/lib/posts"

interface StartupPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function StartupPage({ params }: StartupPageProps) {
  // Await params for Next.js 15 compatibility
  const { slug } = await params
  
  console.log('StartupPage rendering for slug:', slug)
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  
  try {
    // Get the startup
    console.log('Fetching startup for slug:', slug)
    const startup = await getStartupBySlug(slug)
    
    if (!startup) {
      console.log('Startup not found for slug:', slug)
      notFound()
    }

    console.log('Startup found:', startup.name)

    // Get all posts to filter for this startup's posts
    const allPosts = await getPosts(user?.id)
    const startupPosts = allPosts.filter(post => post.startup?.id === startup.id)
    
    console.log('Found', startupPosts.length, 'related posts for startup')

    return (
      <StartupClientWrapper
        startup={startup}
        relatedPosts={startupPosts}
      />
    )
  } catch (error) {
    console.error("Error loading startup page:", error)
    notFound()
  }
}

export async function generateMetadata({ params }: StartupPageProps) {
  try {
    // Await params for Next.js 15 compatibility
    const { slug } = await params
    const startup = await getStartupBySlug(slug)
    
    if (!startup) {
      return {
        title: "Startup not found"
      }
    }

    const title = `${startup.name} - ${startup.stage} stage startup`
    const description = startup.description || `${startup.name} is a ${startup.stage} stage startup.`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        siteName: 'Startups Are Easy',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      }
    }
  } catch (error) {
    return {
      title: "Startup not found"
    }
  }
}
