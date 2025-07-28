import { supabase } from "./supabase";
import type { PostFormData, Startup, Post } from "./types";

// Enhanced post creation that handles different post types
export async function createEnhancedPost(
    formData: PostFormData,
    userId: string
): Promise<{ post: Post; startup?: Startup }> {
    let startup: Startup | undefined;

    // Handle startup creation/selection based on post type
    if (formData.type === "idea") {
        // Create new startup in idea stage
        const { data: startupData, error: startupError } = await supabase
            .from("startups")
            .insert({
                name: formData.startup_name!,
                description: formData.startup_description!,
                stage: "idea",
                user_id: userId,
                is_public: true,
            })
            .select()
            .single();

        if (startupError) throw startupError;
        startup = startupData;
    } else if (formData.type === "launch") {
        if (formData.existing_startup_id) {
            // Update existing startup to launched stage
            const { data: startupData, error: startupError } = await supabase
                .from("startups")
                .update({
                    stage: "launched",
                    launch_date: new Date().toISOString().split('T')[0],
                    website_url: formData.link,
                })
                .eq("id", formData.existing_startup_id)
                .eq("user_id", userId)
                .select()
                .single();

            if (startupError) throw startupError;
            startup = startupData;
        } else {
            // Create new startup directly in launched stage
            const { data: startupData, error: startupError } = await supabase
                .from("startups")
                .insert({
                    name: formData.startup_name!,
                    description: formData.startup_description!,
                    stage: "launched",
                    launch_date: new Date().toISOString().split('T')[0],
                    website_url: formData.link,
                    user_id: userId,
                    is_public: true,
                })
                .select()
                .single();

            if (startupError) throw startupError;
            startup = startupData;
        }
    } else if (formData.type === "progress" && formData.existing_startup_id) {
        // Get the existing startup for the post
        const { data: startupData, error: startupError } = await supabase
            .from("startups")
            .select("*")
            .eq("id", formData.existing_startup_id)
            .eq("user_id", userId)
            .single();

        if (startupError) throw startupError;
        startup = startupData;
    }

    // Create the post with appropriate content
    let postContent = formData.content || "";

    // Auto-format content for idea and launch posts
    if (formData.type === "idea" && startup) {
        postContent = `💡 **${startup.name}**\n\n${startup.description}`;
    } else if (formData.type === "launch" && startup) {
        postContent = formData.content || `🚀 **${startup.name}** is now live!\n\n${startup.description}`;
    }

    const { data: postData, error: postError } = await supabase
        .from("posts")
        .insert({
            user_id: userId,
            type: formData.type,
            content: postContent,
            link: formData.link,
            startup_id: startup?.id,
        })
        .select(`
      *,
      user:profiles(*),
      startup:startups!posts_startup_id_fkey(*)
    `)
        .single();

    if (postError) throw postError;

    // Update startup with launch post reference if it's a launch
    if (formData.type === "launch" && startup) {
        await supabase
            .from("startups")
            .update({ launch_post_id: postData.id })
            .eq("id", startup.id);
    }

    return { post: postData, startup };
}

// Get user's startups for post creation
export async function getUserStartupsForPosts(userId: string): Promise<Startup[]> {
    const { data, error } = await supabase
        .from("startups")
        .select("*")
        .eq("user_id", userId)
        .eq("is_public", true)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
}

// Get startup summary for user
export async function getUserStartupSummary(userId: string) {
    const { data, error } = await supabase
        .from("user_startup_summary")
        .select("*")
        .eq("user_id", userId)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" errors

    return data || {
        ideas_count: 0,
        launched_count: 0,
        building_count: 0
    };
}
