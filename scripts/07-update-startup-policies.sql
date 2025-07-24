BEGIN;

-- Helper functions for checking startup roles
CREATE OR REPLACE FUNCTION is_startup_member(p_startup_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM startup_members
     WHERE startup_id = p_startup_id
       AND user_id = p_user_id
       AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION is_startup_founder(p_startup_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM startup_members
     WHERE startup_id = p_startup_id
       AND user_id = p_user_id
       AND is_active = true
       AND role IN ('founder', 'co-founder')
  );
$$;

GRANT EXECUTE ON FUNCTION is_startup_member(uuid, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION is_startup_founder(uuid, uuid) TO PUBLIC;

-- Update policies to use helper functions
DROP POLICY IF EXISTS "Startup members can view their startup" ON startups;
CREATE POLICY "Startup members can view their startup" ON startups
  FOR SELECT USING (is_startup_member(startups.id, auth.uid()));

DROP POLICY IF EXISTS "Startup founders can update their startup" ON startups;
CREATE POLICY "Startup founders can update their startup" ON startups
  FOR UPDATE USING (is_startup_founder(startups.id, auth.uid()));

DROP POLICY IF EXISTS "Startup members can view all members of their startup" ON startup_members;
CREATE POLICY "Startup members can view all members of their startup" ON startup_members
  FOR SELECT USING (is_startup_member(startup_members.startup_id, auth.uid()));

DROP POLICY IF EXISTS "Startup founders can manage members" ON startup_members;
CREATE POLICY "Startup founders can manage members" ON startup_members
  FOR ALL USING (is_startup_founder(startup_members.startup_id, auth.uid()));

COMMIT;
