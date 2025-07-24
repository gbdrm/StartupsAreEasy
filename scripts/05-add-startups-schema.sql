-- Create startups table
CREATE TABLE startups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL-friendly version of name
  description TEXT,
  website_url TEXT,
  logo_url TEXT,
  industry TEXT,
  stage TEXT,
  founded_date DATE,
  location TEXT,
  team_size INTEGER,
  funding_raised DECIMAL(15,2), -- in USD
  is_public BOOLEAN DEFAULT true, -- whether startup is publicly visible
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create startup_members table (many-to-many relationship)
CREATE TABLE startup_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  title TEXT, -- job title like "CTO", "Head of Marketing"
  equity_percentage DECIMAL(5,2), -- optional equity percentage
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(startup_id, user_id)
);

-- Create startup_followers table
CREATE TABLE startup_followers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(startup_id, user_id)
);

-- Add startup_id to posts table (optional - posts can be personal or startup-related)
ALTER TABLE posts ADD COLUMN startup_id UUID REFERENCES startups(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_startups_slug ON startups(slug);
CREATE INDEX idx_startups_industry ON startups(industry);
CREATE INDEX idx_startups_stage ON startups(stage);
CREATE INDEX idx_startup_members_startup_id ON startup_members(startup_id);
CREATE INDEX idx_startup_members_user_id ON startup_members(user_id);
CREATE INDEX idx_startup_followers_startup_id ON startup_followers(startup_id);
CREATE INDEX idx_startup_followers_user_id ON startup_followers(user_id);
CREATE INDEX idx_posts_startup_id ON posts(startup_id);

-- Enable RLS on new tables
ALTER TABLE startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_followers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for startups
CREATE POLICY "Anyone can view public startups" ON startups 
  FOR SELECT USING (is_public = true);

CREATE POLICY "Startup members can view their startup" ON startups 
  FOR SELECT USING (
    id IN (
      SELECT startup_id FROM startup_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Authenticated users can create startups" ON startups 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Startup founders can update their startup" ON startups 
  FOR UPDATE USING (
    id IN (
      SELECT startup_id FROM startup_members 
      WHERE user_id = auth.uid() 
      AND role IN ('founder', 'co-founder') 
      AND is_active = true
    )
  );

-- RLS Policies for startup_members
CREATE POLICY "Anyone can view startup members of public startups" ON startup_members 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM startups s
      WHERE s.id = startup_members.startup_id
        AND s.is_public = true
    )
  );

CREATE POLICY "Startup members can view all members of their startup" ON startup_members 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM startup_members sm
      WHERE sm.startup_id = startup_members.startup_id
        AND sm.user_id = auth.uid()
        AND sm.is_active = true
    )
  );

CREATE POLICY "Startup founders can manage members" ON startup_members 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM startup_members sm
      WHERE sm.startup_id = startup_members.startup_id
        AND sm.user_id = auth.uid()
        AND sm.is_active = true
        AND sm.role IN ('founder', 'co-founder')
    )
  );

CREATE POLICY "Users can join startups" ON startup_members 
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- RLS Policies for startup_followers
CREATE POLICY "Anyone can view followers of public startups" ON startup_followers 
  FOR SELECT USING (
    startup_id IN (SELECT id FROM startups WHERE is_public = true)
  );

CREATE POLICY "Users can follow/unfollow startups" ON startup_followers 
  FOR ALL USING (auth.uid() = user_id);

-- Create function to generate slug from name
CREATE OR REPLACE FUNCTION generate_startup_slug(startup_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(regexp_replace(trim(startup_name), '[^a-zA-Z0-9]+', '-', 'g'));
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate slug
CREATE OR REPLACE FUNCTION set_startup_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_startup_slug(NEW.name);
    
    -- Ensure uniqueness by appending number if needed
    WHILE EXISTS (SELECT 1 FROM startups WHERE slug = NEW.slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
      NEW.slug := NEW.slug || '-' || floor(random() * 1000)::text;
    END LOOP;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_startup_slug
  BEFORE INSERT OR UPDATE ON startups
  FOR EACH ROW EXECUTE FUNCTION set_startup_slug();

-- Create function to automatically add creator as founder
CREATE OR REPLACE FUNCTION add_startup_founder()
RETURNS TRIGGER AS $$
BEGIN
  -- Add the creator as a founder
  INSERT INTO startup_members (startup_id, user_id, role, title)
  VALUES (NEW.id, auth.uid(), 'founder', 'Founder');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_add_startup_founder
  AFTER INSERT ON startups
  FOR EACH ROW EXECUTE FUNCTION add_startup_founder();
