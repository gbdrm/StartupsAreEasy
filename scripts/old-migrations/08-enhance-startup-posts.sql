-- Additional columns needed for the enhanced post flow
ALTER TABLE startups 
ADD COLUMN IF NOT EXISTS launch_date DATE,
ADD COLUMN IF NOT EXISTS launch_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;

-- Add index for better performance when filtering by stage
CREATE INDEX IF NOT EXISTS idx_startups_stage ON startups(stage);
CREATE INDEX IF NOT EXISTS idx_startups_user_stage ON startups(user_id, stage);

-- Add a view for easier querying of user's ideas/launches
CREATE OR REPLACE VIEW user_startup_summary AS
SELECT 
  s.user_id,
  COUNT(*) FILTER (WHERE s.stage = 'idea') as ideas_count,
  COUNT(*) FILTER (WHERE s.stage IN ('launched', 'scaling')) as launched_count,
  COUNT(*) FILTER (WHERE s.stage IN ('building', 'mvp', 'beta')) as building_count
FROM startups s
WHERE s.is_public = true
GROUP BY s.user_id;
