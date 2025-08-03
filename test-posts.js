// Test script to verify posts loading with startup info and likes
const { getPostsDirect } = require('./lib/api-direct.ts')

console.log('🧪 Testing posts loading...')

async function testPosts() {
    try {
        // Test without user ID (anonymous)
        console.log('\n1️⃣ Testing anonymous posts loading...')
        const anonymousPosts = await getPostsDirect()
        console.log(`Loaded ${anonymousPosts.length} posts anonymously`)

        if (anonymousPosts.length > 0) {
            const firstPost = anonymousPosts[0]
            console.log('First post:', {
                id: firstPost.id,
                type: firstPost.type,
                user: firstPost.user.name,
                likes_count: firstPost.likes_count,
                liked_by_user: firstPost.liked_by_user,
                has_startup: !!firstPost.startup,
                startup_name: firstPost.startup?.name
            })
        }

        // Test with a fake user ID
        console.log('\n2️⃣ Testing posts loading with user ID...')
        const userPosts = await getPostsDirect('6eb31970-00df-4049-9bab-409bed21962e')
        console.log(`Loaded ${userPosts.length} posts with user context`)

        if (userPosts.length > 0) {
            const firstPost = userPosts[0]
            console.log('First post with user context:', {
                id: firstPost.id,
                type: firstPost.type,
                user: firstPost.user.name,
                likes_count: firstPost.likes_count,
                liked_by_user: firstPost.liked_by_user,
                has_startup: !!firstPost.startup,
                startup_name: firstPost.startup?.name
            })
        }

    } catch (error) {
        console.error('❌ Error testing posts:', error)
    }
}

testPosts()
