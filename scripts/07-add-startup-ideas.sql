-- Add missing columns to existing startups table for idea functionality
ALTER TABLE startups 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS target_market TEXT,
ADD COLUMN IF NOT EXISTS estimated_timeline TEXT,
ADD COLUMN IF NOT EXISTS looking_for TEXT[];

-- Update stage constraint to include new stages
ALTER TABLE startups DROP CONSTRAINT IF EXISTS startups_stage_check;
ALTER TABLE startups 
ADD CONSTRAINT startups_stage_check CHECK (
  stage = ANY(ARRAY[
    'idea'::text,
    'planning'::text,
    'building'::text,
    'mvp'::text,
    'beta'::text,
    'launched'::text,
    'scaling'::text,
    'acquired'::text,
    'paused'::text
  ])
);

-- Add optional foreign key to posts table to link posts to startups/ideas
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS startup_id UUID REFERENCES startups(id) ON DELETE SET NULL;

-- Add RLS policies if they don't exist
ALTER TABLE startups ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Startups are viewable by everyone" ON startups;
DROP POLICY IF EXISTS "Users can insert their own startups" ON startups;
DROP POLICY IF EXISTS "Users can update their own startups" ON startups;
DROP POLICY IF EXISTS "Users can delete their own startups" ON startups;

CREATE POLICY "Startups are viewable by everyone" ON startups
  FOR SELECT USING (is_public = true);

-- Only allow authenticated users to insert their own startups
CREATE POLICY "Users can insert their own startups" ON startups
  FOR INSERT WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- Only allow users to update their own startups
CREATE POLICY "Users can update their own startups" ON startups
  FOR UPDATE USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Only allow users to delete their own startups
CREATE POLICY "Users can delete their own startups" ON startups
  FOR DELETE USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Create additional indexes
CREATE INDEX IF NOT EXISTS idx_startups_user_id ON startups(user_id);
CREATE INDEX IF NOT EXISTS idx_startups_created_at ON startups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_startup_id ON posts(startup_id);
