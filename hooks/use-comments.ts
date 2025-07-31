import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { createComment, toggleLike } from "@/lib/posts"
import type { User, Post, Comment } from "@/lib/types"

export function useComments(currentUser: User | null, setPosts: React.Dispatch<React.SetStateAction<Post[]>>) {
    const [comments, setComments] = useState<Comment[]>([])

    const loadComments = async (postIds: string[]) => {
        if (postIds.length === 0) {
            setComments([])
            return
        }

        try {
            // First get comments - simple query without foreign key joins
            const { data: allComments, error: commentsError } = await supabase
                .from("comments")
                .select("id, content, created_at, user_id, post_id")
                .in("post_id", postIds)
                .order("created_at", { ascending: true })

            if (commentsError) {
                console.error("Error loading comments:", commentsError)
                setComments([])
                return
            }

            if (!allComments || allComments.length === 0) {
                setComments([])
                return
            }

            // Get unique user IDs from comments
            const userIds = [...new Set(allComments.map(comment => comment.user_id))]

            // Fetch user profiles separately
            const { data: profiles, error: profilesError } = await supabase
                .from("profiles")
                .select("id, username, first_name, last_name, avatar_url")
                .in("id", userIds)

            if (profilesError) {
                console.error("Error loading profiles:", profilesError)
                setComments([])
                return
            }

            // Create a map for quick profile lookup
            const profileMap = new Map(profiles?.map(profile => [profile.id, profile]) || [])

            const formattedComments = allComments.map((comment: any) => {
                const profile = profileMap.get(comment.user_id)
                return {
                    id: comment.id,
                    content: comment.content,
                    created_at: comment.created_at,
                    user_id: comment.user_id,
                    post_id: comment.post_id,
                    user: {
                        id: comment.user_id,
                        name: profile ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "Unknown User",
                        username: profile?.username || "unknown",
                        avatar: profile?.avatar_url,
                    }
                }
            })
            setComments(formattedComments)
        } catch (error) {
            console.error("Error loading comments:", error)
            setComments([])
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

            // Update comment count
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

    const handleLike = async (postId: string) => {
        if (!currentUser) return

        try {
            const isLiked = await toggleLike(postId, currentUser.id)
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

    return {
        comments,
        loadComments,
        handleComment,
        handleLike
    }
}
