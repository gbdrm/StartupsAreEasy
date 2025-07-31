-- Add bio, location, and website fields to profiles table
-- These fields are used in the profile page UI

ALTER TABLE profiles 
ADD COLUMN bio TEXT,
ADD COLUMN location TEXT,
ADD COLUMN website TEXT;

-- Add indexes for better query performance if needed
-- CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(location);
